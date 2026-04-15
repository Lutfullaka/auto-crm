// AutoCRM - Asosiy mantiq (JavaScript)
// Izoh: Ushbu versiya to'liq orqa backend - SUPABASE ga ulangan.

const supabaseUrl = 'https://xyubrbbvjufifrilrbab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dWJyYmJ2anVmaWZyaWxyYmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTUxMzksImV4cCI6MjA5MTczMTEzOX0.UwBygN8dBeMu-dhAERuLFjzAlH5DsTaum_SwxsnbYa4';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- Holat (State) ---
let currentUser = null;
let globalDB = { users: [], dealerships: [], cars: [], sales: [], customers: [] };
let selectedCars = new Set();

// --- Bazani yangilash ---
const refreshDB = async () => {
    try {
        const [u, d, c, s, cust] = await Promise.all([
            _supabase.from('users').select('*'),
            _supabase.from('dealerships').select('*'),
            _supabase.from('cars').select('*').order('id', {ascending: false}),
            _supabase.from('sales').select('*').order('date', {ascending: false}),
            _supabase.from('customers').select('*').order('id', {ascending: false})
        ]);
        
        if (u.error) alert("Supabase ga ulanishda xato: " + u.error.message);
        
        globalDB.users = u.data || [];
        globalDB.dealerships = d.data || [];
        globalDB.cars = c.data || [];
        globalDB.sales = s.data || [];
        globalDB.customers = cust.data || [];
    } catch (err) {
        alert("Tarmoqda xatolik yoki URL xato: " + err.message);
    }
};

const refreshDataAndRender = async (viewId) => {
    // Show a small loader if we want, but Supabase is fast enough
    await refreshDB();
    renderView(viewId);
};

// --- Dastur Yuklanishi ---
document.addEventListener('DOMContentLoaded', async () => {
    await refreshDB(); // Boshida bazadan hamma ma'lumotni olib kelamiz

    const sessionUser = sessionStorage.getItem('active_user');
    if (sessionUser) {
        currentUser = JSON.parse(sessionUser);
        showDashboard();
    }

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        const user = globalDB.users.find(u => u.email === email && u.password === pass);
        if (user) {
            currentUser = user;
            sessionStorage.setItem('active_user', JSON.stringify(user));
            showDashboard();
        } else {
            alert("Email yoki Parol xato! (Yoki SQL kod ishlatilmagan)");
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('active_user');
        currentUser = null;
        document.getElementById('dashboard-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    });

    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            selectedCars.clear(); // Oynaga o'tganda tanlanganlar tozalanadi
            refreshDataAndRender(item.getAttribute('data-view')); // Har gal bosganda bazani yangilaymiz!
        });
    });

    // Theme toggle o'chirildi (Topbar bilan birga)
});

const showDashboard = () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('current-user-role').textContent = currentUser.role === 'admin' ? "Bosh Admin" : "Diler";
    
    if (currentUser.role === 'dealer') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelector('.nav-item[data-view="inventory"]').click(); 
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelector('.nav-item[data-view="dashboard"]').click(); 
    }
};

const renderView = (viewId) => {
    const area = document.getElementById('content-area');
    const db = globalDB;
    let html = '';

    if (viewId === 'dashboard') {
        const totalChina   = db.cars.filter(c => c.status === 'ordered').length;
        const totalCustoms = db.cars.filter(c => c.status === 'customs').length;
        const totalDealers = db.cars.filter(c => c.status === 'instock').length;
        const totalSoldAll = db.cars.filter(c => c.status === 'sold').length;

        // --- Oylik savdolar (so'nggi 6 oy) ---
        const now = new Date();
        const monthNames = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
        const last6Months = Array.from({length: 6}, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { label: monthNames[d.getMonth()] + ' ' + d.getFullYear(), month: d.getMonth(), year: d.getFullYear(), count: 0, revenue: 0 };
        });
        db.sales.forEach(s => {
            const d = new Date(s.date);
            const slot = last6Months.find(m => m.month === d.getMonth() && m.year === d.getFullYear());
            if (slot) { slot.count++; slot.revenue += parseFloat(s.price) || 0; }
        });
        const maxCount = Math.max(...last6Months.map(m => m.count), 1);

        // --- Oxirgi oy ---
        const lastMonth = last6Months[last6Months.length - 1];
        const prevMonth = last6Months[last6Months.length - 2];
        const lastMonthSales = db.sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === lastMonth.month && d.getFullYear() === lastMonth.year;
        });
        const lastRevenue = lastMonth.revenue;
        const prevRevenue = prevMonth.revenue;
        const revDelta = prevRevenue > 0 ? Math.round(((lastRevenue - prevRevenue) / prevRevenue) * 100) : 0;

        // --- TOP Modellar (jami sotilganlar orasida) ---
        const modelCount = {};
        db.sales.forEach(s => { modelCount[s.car_model] = (modelCount[s.car_model] || 0) + 1; });
        const topModels = Object.entries(modelCount).sort((a,b) => b[1]-a[1]).slice(0, 5);
        const maxModel = topModels.length ? topModels[0][1] : 1;

        // --- Diler ko'rsatgichlari ---
        const dealerStats = db.dealerships.map(d => {
            const dSales = db.sales.filter(s => s.dealer_id === d.id);
            const dStock = db.cars.filter(c => c.location === 'dealer_' + d.id && c.status === 'instock').length;
            return { name: d.name, sales: dSales.length, stock: dStock, revenue: dSales.reduce((sum, s) => sum + (parseFloat(s.price)||0), 0) };
        }).sort((a,b) => b.sales - a.sales);
        const maxDealerSale = dealerStats.length ? Math.max(...dealerStats.map(d => d.sales), 1) : 1;

        // --- Oxirgi 5 ta sotuv ---
        const recentSales = db.sales.slice(0, 5);

        html = `
            <div class="view-header mb-4 mt-2">
                <h1>Asosiy Boshqaruv Paneli</h1>
                <span style="font-size:0.85rem; color:var(--text-muted);">
                    ${now.toLocaleDateString('uz-UZ', {day:'numeric', month:'long', year:'numeric'})} holatiga ko'ra
                </span>
            </div>

            <!-- KPI kartalar -->
            <div class="stats-grid mb-6">
                <div class="stat-card">
                    <div class="stat-title">Xitoyda (Zavod)</div>
                    <div class="stat-value">${totalChina} <small style="font-size:1rem">ta</small></div>
                    <div class="stat-subtitle"><span>Buyurtmada</span></div>
                    <i class="ph ph-factory stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Bojxonada</div>
                    <div class="stat-value text-warning">${totalCustoms} <small style="font-size:1rem">ta</small></div>
                    <div class="stat-subtitle"><span>Kutilmoqda</span></div>
                    <i class="ph ph-truck stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Omborlarda</div>
                    <div class="stat-value text-success">${totalDealers} <small style="font-size:1rem">ta</small></div>
                    <div class="stat-subtitle"><span>Sotuvga tayyor</span></div>
                    <i class="ph ph-storefront stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Jami Sotildi</div>
                    <div class="stat-value text-accent">${totalSoldAll} <small style="font-size:1rem">ta</small></div>
                    <div class="stat-subtitle"><span>Barcha vaqt</span></div>
                    <i class="ph ph-currency-circle-dollar stat-icon"></i>
                </div>
            </div>

            <!-- 2 ustunli blok: Oylik grafik + Oxirgi oy -->
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">

                <!-- Oylik savdolar grafigi (bar chart) -->
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin:0 0 1.25rem; font-size:1rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:.05em;">
                        <i class="ph ph-chart-bar" style="margin-right:.4rem; color:var(--accent-primary);"></i> Oylik Savdolar Dinamikasi
                    </h3>
                    <div style="display:flex; align-items:flex-end; gap:0.75rem; height:160px;">
                        ${last6Months.map((m, i) => {
                            const h = maxCount > 0 ? Math.max(Math.round((m.count / maxCount) * 140), 4) : 4;
                            const isLast = i === last6Months.length - 1;
                            return `
                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
                                <span style="font-size:.72rem; font-weight:600; color:${isLast ? 'var(--accent-primary)' : 'var(--text-muted)'};">${m.count}</span>
                                <div style="width:100%; height:${h}px; background:${isLast ? 'var(--accent-primary)' : '#e4e6eb'}; border-radius:6px 6px 0 0; transition:.3s;"></div>
                                <span style="font-size:.68rem; color:var(--text-muted); text-align:center; white-space:nowrap;">${m.label}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Oxirgi oy natijalari -->
                <div class="glass-card" style="padding: 1.5rem; display:flex; flex-direction:column; gap:1rem;">
                    <h3 style="margin:0; font-size:1rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:.05em;">
                        <i class="ph ph-calendar-check" style="margin-right:.4rem; color:var(--success);"></i> ${lastMonth.label} Natijasi
                    </h3>
                    <div style="text-align:center; padding:1rem 0;">
                        <div style="font-size:2.5rem; font-weight:800; color:var(--success); line-height:1;">${lastMonth.count}</div>
                        <div style="color:var(--text-muted); font-size:.85rem; margin-top:.3rem;">ta sotildi</div>
                    </div>
                    <div style="background:rgba(49,162,76,.12); border-radius:8px; padding:.75rem; text-align:center;">
                        <div style="font-size:1.25rem; font-weight:700; color:var(--success);">$${lastRevenue.toLocaleString()}</div>
                        <div style="font-size:.75rem; color:var(--text-secondary);">Daromad</div>
                    </div>
                    <div style="text-align:center; font-size:.85rem; color:${revDelta >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">
                        <i class="ph ph-${revDelta >= 0 ? 'trend-up' : 'trend-down'}"></i>
                        ${revDelta >= 0 ? '+' : ''}${revDelta}% oldingi oyga nisbatan
                    </div>
                </div>
            </div>

            <!-- 2 ustunli blok: Top Modellar + Diler ko'rsatgichlari -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">

                <!-- TOP Modellar -->
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin:0 0 1.25rem; font-size:1rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:.05em;">
                        <i class="ph ph-trophy" style="margin-right:.4rem; color:var(--warning);"></i> Eng Ko'p Sotilgan Modellar
                    </h3>
                    ${topModels.length === 0 ? `<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">Sotuvlar ma'lumoti yo'q</p>` :
                    topModels.map(([model, count], i) => `
                        <div style="margin-bottom:.9rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:.35rem;">
                                <span style="font-weight:600; font-size:.9rem;">
                                    ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`} ${model}
                                </span>
                                <span style="font-size:.85rem; color:var(--text-secondary); font-weight:600;">${count} ta</span>
                            </div>
                            <div style="background:#e4e6eb; border-radius:4px; height:6px;">
                                <div style="width:${Math.round((count/maxModel)*100)}%; height:100%; background:var(--warning); border-radius:4px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Diler reytingi -->
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin:0 0 1.25rem; font-size:1rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:.05em;">
                        <i class="ph ph-storefront" style="margin-right:.4rem; color:var(--accent-primary);"></i> Diler Ko'rsatgichlari
                    </h3>
                    ${dealerStats.length === 0 ? `<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">Dilerlar yo'q</p>` :
                    dealerStats.map((d, i) => `
                        <div style="margin-bottom:.9rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.35rem;">
                                <span style="font-weight:600; font-size:.9rem;">${i+1}. ${d.name}</span>
                                <div style="display:flex; gap:.5rem; font-size:.78rem; color:var(--text-secondary);">
                                    <span>📦 ${d.stock}</span>
                                    <span>✅ ${d.sales}</span>
                                </div>
                            </div>
                            <div style="background:#e4e6eb; border-radius:4px; height:6px;">
                                <div style="width:${Math.round((d.sales/maxDealerSale)*100)}%; height:100%; background:var(--accent-primary); border-radius:4px;"></div>
                            </div>
                            <div style="font-size:.75rem; color:var(--success); margin-top:.25rem; font-weight:700;">$${d.revenue.toLocaleString()} daromad</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Oxirgi 5 ta sotuv -->
            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="margin:0 0 1.25rem; font-size:1rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase; letter-spacing:.05em;">
                    <i class="ph ph-clock-clockwise" style="margin-right:.4rem; color:var(--danger);"></i> Oxirgi Sotuvlar
                </h3>
                ${recentSales.length === 0 ? `<p style="color:var(--text-muted); text-align:center; padding:2rem 0;">Hali sotuv amalga oshirilmagan</p>` : `
                <div class="table-container" style="margin:0; border:none; box-shadow:none;">
                    <table>
                        <thead>
                            <tr>
                                <th>Sana</th>
                                <th>Model</th>
                                <th>Mijoz</th>
                                <th>Narxi</th>
                                <th>To'lov turi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentSales.map(s => `
                                <tr>
                                    <td style="color:var(--text-secondary); font-size:.85rem;">${new Date(s.date).toLocaleDateString('uz-UZ')}</td>
                                    <td><strong>${s.car_model || '-'}</strong></td>
                                    <td>${s.customer_name || '-'}</td>
                                    <td style="color:var(--success); font-weight:800;">$${parseFloat(s.price||0).toLocaleString()}</td>
                                    <td><span class="badge" style="background:${s.payment_type==='cash' ? 'rgba(49,162,76,.12)' : 'rgba(24,119,242,.12)'}; color:${s.payment_type==='cash' ? 'var(--success)' : 'var(--accent-primary)'}; padding:.3rem .6rem; border-radius:6px;">${s.payment_type === 'cash' ? 'Naqd' : 'Muddatli'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`}
            </div>
        `;
    } 
    else if (viewId === 'orders') {
        const chinaCars = db.cars.filter(c => c.status === 'ordered');
        html = `
            <div class="view-header">
                <h1>Xitoydan kelayotgan</h1>
                <div class="flex-gap">
                    <button class="btn btn-secondary" onclick="deleteSelected()" style="background:var(--danger); border-color:var(--danger);"><i class="ph ph-trash"></i> Tanlanganlarni O'chirish</button>
                    <button class="btn btn-secondary" onclick="downloadShablon()">📄 Shablon Yuklash (Excel)</button>
                    <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
                        <i class="ph ph-upload-simple"></i> Exceldan Yuklash
                        <input type="file" id="excel-upload-orders" accept=".xlsx, .xls" class="hidden" onchange="uploadExcel(event, 'ordered')">
                    </label>
                    <button class="btn btn-primary" onclick="openOrderModal()"><i class="ph ph-plus"></i> Qo'lda Qo'shish</button>
                    <button class="btn btn-accent" onclick="openTransferModal('ordered')" style="background:var(--accent-color); border-color:var(--accent-color);"><i class="ph ph-truck"></i> Transfer (Yuborish)</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" onclick="toggleAllCars(event, 'ordered')"></th>
                            <th>Avtomobil (Marka, Model)</th>
                            <th>Komp (Trim)</th>
                            <th>Yoqilg'i</th>
                            <th>Rangi (Tashqi/Ichki)</th>
                            <th>VIN Kod</th>
                            <th>Zavod Narxi</th>
                            <th>Yakuniy Sebestoimost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chinaCars.map(c => `
                            <tr>
                                <td><input type="checkbox" class="car-select" value="${c.id}" ${selectedCars.has(c.id) ? 'checked' : ''} onchange="toggleCarSelection(${c.id}, event)"></td>
                                <td><strong>${c.model}</strong></td>
                                <td>${c.trim || '-'}</td>
                                <td>${c.fuel || '-'}</td>
                                <td>${c.color_ext || '-'} / ${c.color_int || '-'}</td>
                                <td><span style="font-family: monospace;">${c.vin || 'Kiritilmagan'}</span></td>
                                <td>$${c.factory_price || 0}</td>
                                <td><strong>$${c.final_cost || 0}</strong></td>
                            </tr>
                        `).join('')}
                        ${chinaCars.length === 0 ? "<tr><td colspan='8'>Buyurtmalar yo'q.</td></tr>" : ""}
                    </tbody>
                </table>
            </div>
        `;
    }
    else if (viewId === 'customs') {
        const customCars = db.cars.filter(c => c.status === 'customs');
        const dealersOptions = db.dealerships.map(d => `<option value="dealer_${d.id}">${d.name}</option>`).join('');
        
        html = `
            <div class="view-header">
                <h1>Bojxona (Tamojnya) Ombordagi Mashinalar</h1>
                <div class="flex-gap">
                    <button class="btn btn-secondary" onclick="deleteSelected()" style="background:var(--danger); border-color:var(--danger);"><i class="ph ph-trash"></i> Tanlanganlarni O'chirish</button>
                    <button class="btn btn-secondary" onclick="downloadShablon()">📄 Shablon Yuklash (Excel)</button>
                    <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
                        <i class="ph ph-upload-simple"></i> Bojxona Omboriga Exceldan qabul
                        <input type="file" id="excel-upload-customs" accept=".xlsx, .xls" class="hidden" onchange="uploadExcel(event, 'customs')">
                    </label>
                    <button class="btn btn-accent" onclick="openTransferModal('customs')" style="background:var(--accent-color); border-color:var(--accent-color);"><i class="ph ph-truck"></i> Transfer (Peremesheniya)</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" onclick="toggleAllCars(event, 'customs')"></th>
                            <th>Avtomobil (Marka, Model)</th>
                            <th>Komp (Trim)</th>
                            <th>Yoqilg'i</th>
                            <th>Rangi (Tashqi/Ichki)</th>
                            <th>VIN Kod</th>
                            <th>Zavod Narxi</th>
                            <th>Yakuniy Sebestoimost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customCars.map(c => `
                            <tr>
                                <td><input type="checkbox" class="car-select" value="${c.id}" ${selectedCars.has(c.id) ? 'checked' : ''} onchange="toggleCarSelection(${c.id}, event)"></td>
                                <td><strong>${c.model}</strong></td>
                                <td>${c.trim || '-'}</td>
                                <td>${c.fuel || '-'}</td>
                                <td>${c.color_ext || '-'} / ${c.color_int || '-'}</td>
                                <td><span style="font-family: monospace;">${c.vin || 'Kiritilmagan'}</span></td>
                                <td>$${c.factory_price || 0}</td>
                                <td><strong>$${c.final_cost || 0}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    else if (viewId === 'dealers') {
        html = `
            <div class="view-header">
                <h1>Dilerlar Kesimida Hisobot</h1>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Diler Nomi</th>
                            <th>Ombordagi Mashinalar (V Nalichii)</th>
                            <th>Ombor Qiymati (Sebestoimost)</th>
                            <th>Sotilgan Mashinalar</th>
                            <th>Jami Sotuv Aylanmasi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${db.dealerships.map(d => {
                            const carsInStock = db.cars.filter(c => c.location === 'dealer_' + d.id && c.status === 'instock');
                            const totalStockValue = carsInStock.reduce((sum, c) => sum + (c.final_cost || 0), 0);
                            
                            const soldCars = db.sales.filter(s => s.dealer_id === d.id);
                            const totalSalesValue = soldCars.reduce((sum, s) => sum + (s.price || 0), 0);

                            return `
                                <tr>
                                    <td><strong>🏢 ${d.name}</strong></td>
                                    <td><span class="badge status-instock">${carsInStock.length} ta</span></td>
                                    <td>$${totalStockValue.toLocaleString()}</td>
                                    <td><span class="badge status-ordered">${soldCars.length} ta sotildi</span></td>
                                    <td><strong>$${totalSalesValue.toLocaleString()}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                        ${db.dealerships.length === 0 ? "<tr><td colspan='5'>Dilerlar ro'yxati bo'sh!</td></tr>" : ""}
                    </tbody>
                </table>
            </div>
        `;
    }
    else if (viewId === 'inventory') {
        const dealerId = currentUser.role === 'dealer' ? currentUser.dealership_id : null;
        let myCars = db.cars.filter(c => c.status === 'instock');
        if (dealerId) myCars = myCars.filter(c => c.location === 'dealer_' + dealerId);

        html = `
             <div class="view-header">
                <h1>${currentUser.role === 'dealer' ? "Mening Omborim (V nalichii)" : "Barcha Dilerlar Ombori"}</h1>
                <div class="flex-gap">
                    ${currentUser.role === 'admin' ? `<button class="btn btn-secondary" onclick="deleteSelected()" style="background:var(--danger); border-color:var(--danger);"><i class="ph ph-trash"></i> Tanlanganlarni O'chirish</button>` : ""}
                    ${currentUser.role === 'admin' ? `<button class="btn btn-accent" onclick="openTransferModal('instock')" style="background:var(--accent-color); border-color:var(--accent-color);"><i class="ph ph-arrows-left-right"></i> Transfer (Dilerga)</button>` : ""}
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" onclick="toggleAllCars(event, 'instock')"></th>
                            <th>Avtomobil (Marka, Model)</th>
                            <th>Komp (Trim)</th>
                            <th>Yoqilg'i</th>
                            <th>Rangi (Tashqi/Ichki)</th>
                            <th>VIN Kod</th>
                            <th>Yakuniy Sebestoimost</th>
                            ${currentUser.role === 'admin' ? "<th>Diler Nomi</th>" : ""}
                            <th>Aksiya (Sotish)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myCars.map(c => `
                            <tr>
                                <td><input type="checkbox" class="car-select" value="${c.id}" ${selectedCars.has(c.id) ? 'checked' : ''} onchange="toggleCarSelection(${c.id}, event)"></td>
                                <td><strong>${c.model}</strong></td>
                                <td>${c.trim || '-'}</td>
                                <td>${c.fuel || '-'}</td>
                                <td>${c.color_ext || '-'} / ${c.color_int || '-'}</td>
                                <td><span style="font-family: monospace;">${c.vin || 'Kiritilmagan'}</span></td>
                                <td><strong>$${c.final_cost || 0}</strong></td>
                                ${currentUser.role === 'admin' ? `<td>${db.dealerships.find(d => 'dealer_'+d.id === c.location)?.name || 'Noma\`lum'}</td>` : ""}
                                <td><button class="btn btn-primary" onclick="openSaleModal(${c.id})"><i class="ph ph-shopping-cart"></i> Savdoni yopish</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    else if (viewId === 'sales') {
        let mySales = db.sales;
        if(currentUser.role === 'dealer') {
             mySales = db.sales.filter(s => s.dealer_id === currentUser.dealership_id);
        }

        html = `
            <div class="view-header">
                <h1>Sotuvlar Tarixi va Qarzlar</h1>
                ${currentUser.role === 'dealer' ? `<button class="btn btn-primary" onclick="document.querySelector('.nav-item[data-view=\\'inventory\\']').click()"><i class="ph ph-shopping-cart"></i> Yangi Sotuv qo'shish (Ombordan)</button>` : ''}
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Mijoz FISh</th>
                            <th>Mashina Model</th>
                            <th>VIN</th>
                            <th>To'lov turi</th>
                            <th>Summa</th>
                            ${currentUser.role === 'admin' ? "<th>Diler</th>" : ""}
                        </tr>
                    </thead>
                    <tbody>
                        ${mySales.map(s => `
                            <tr>
                                <td><strong>${s.customer_name}</strong></td>
                                <td>${s.car_model}</td>
                                <td><span style="font-family: monospace;">${s.vin}</span></td>
                                <td>${s.payment_type === 'cash' ? "<span class='badge status-instock'>Naqd</span>" : "<span class='badge status-ordered'>Realizatsiya (Nasiya)</span>"}</td>
                                <td>$${s.price.toLocaleString()}</td>
                                ${currentUser.role === 'admin' ? `<td>${db.dealerships.find(d => d.id === s.dealer_id)?.name || ''}</td>` : ""}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    else if (viewId === 'customers') {
        const customers = db.customers || [];
        html = `
            <div class="view-header">
                <h1>Mijozlar Bazasi</h1>
                <div class="flex-gap">
                    <!-- Kelajakda qo'shish moduli bo'ladi -->
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>F.I.Sh</th>
                            <th>Telefon Raqami</th>
                            <th>Pasport JSHSHIR</th>
                            <th>Manzili</th>
                            <th>Ro'yxatdan O'tgan Sana</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(c => `
                            <tr>
                                <td><strong>${c.full_name}</strong></td>
                                <td>${c.phone}</td>
                                <td>${c.passport || '-'}</td>
                                <td>${c.address || '-'}</td>
                                <td style="color:var(--text-muted);">${new Date(c.created_at).toLocaleDateString('uz-UZ')}</td>
                            </tr>
                        `).join('')}
                        ${customers.length === 0 ? "<tr><td colspan='5'>Hali mijozlar qismini to'ldirmagansiz.</td></tr>" : ""}
                    </tbody>
                </table>
            </div>
        `;
    }

    area.innerHTML = html;
};

// --- Modal & Utility Functions ---
window.downloadShablon = () => {
    const ws = XLSX.utils.json_to_sheet([
        {
            "Марка": "BYD",
            "Модель": "Song Plus",
            "Спецификация": "Flagship 605",
            "Вид топлива": "Elektro",
            "Цвет Кузова": "Qora",
            "Цвет Салона": "Jigarrang",
            "ВИН": "XWW0000000001",
            "Количество": 1,
            "Заводская цена": 25000,
            "Дополнительные расходы": 3000,
            "Итоговая себестоимость": 28000
        }
    ]);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shablon");
    XLSX.writeFile(wb, "AutoCRM_Yuklash_Shabloni.xlsx");
};

window.uploadExcel = (event, targetStatus) => { 
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        document.body.style.opacity = '0.5'; // loading state
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        let loadedCount = 0;
        const rowsToInsert = [];

        json.forEach((row, index) => {
            const qty = parseInt(row["Количество"]) || 1;
            for(let i=0; i<qty; i++) {
                rowsToInsert.push({
                    id: Date.now() + index * 100 + i,
                    model: ((row["Марка"] || "") + " " + (row["Модель"] || "")).trim() || "Noma'lum Avto",
                    trim: row["Спецификация"] || "",
                    fuel: row["Вид топлива"] || "",
                    vin: row["ВИН"] || "",
                    color_ext: row["Цвет Кузова"] || "",
                    color_int: row["Цвет Салона"] || "",
                    factory_price: parseFloat(row["Заводская цена"]) || 0,
                    extra: parseFloat(row["Дополнительные расходы"]) || 0,
                    final_cost: parseFloat(row["Итоговая себестоимость"]) || 0,
                    price: (parseFloat(row["Итоговая себестоимость"]) + 2000) || null,
                    status: targetStatus,
                    location: targetStatus === 'ordered' ? 'china' : 'customs'
                });
                loadedCount++;
            }
        });

        // Insert to Supabase DB
        if(rowsToInsert.length > 0) {
            const { error } = await _supabase.from('cars').insert(rowsToInsert);
            if(error) alert("Xatolik yuz berdi: " + error.message);
        }

        alert(`Bazasiga muvaffaqiyatli ${loadedCount} ta avtomobil Excel dan qabul qilindi!`);
        document.body.style.opacity = '1';
        await refreshDataAndRender(targetStatus === 'ordered' ? 'orders' : 'customs');
        event.target.value = ""; 
    };
    reader.readAsArrayBuffer(file);
};

window.openOrderModal = () => {
    const modalHtml = `
        <div class="modal-overlay" id="order-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Qo'lda Buyurtma Qo'shish</h3>
                    <button class="close-btn" onclick="closeModal('order-modal')"><i class="ph ph-x"></i></button>
                </div>
                <form id="new-order-form">
                    <div class="input-group">
                        <label>Model</label>
                        <input type="text" id="order-model" required placeholder="Masalan: C16">
                    </div>
                    <div class="input-group mt-2">
                        <label>Kuzov Rangi</label>
                        <input type="text" id="order-color" required placeholder="Oq, Qora...">
                    </div>
                    <div class="input-group mt-2">
                        <label>Soni</label>
                        <input type="number" id="order-qty" value="1" min="1" required>
                    </div>
                    <div class="text-right mt-4 flex-gap">
                         <button type="submit" class="btn btn-primary w-full">Buyurtma qilish</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('new-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const model = document.getElementById('order-model').value;
        const color = document.getElementById('order-color').value;
        const qty = parseInt(document.getElementById('order-qty').value);
        
        const rows = [];
        for(let i=0; i<qty; i++){
            rows.push({
                id: Date.now() + Math.floor(Math.random() * 1000000),
                model: model,
                trim: '', fuel: '', color_ext: color, color_int: '',
                vin: '', status: 'ordered', location: 'china',
                factory_price: 0, extra: 0, final_cost: 0, price: 0
            });
        }
        
        const { error } = await _supabase.from('cars').insert(rows);
        if(error) alert("Xatolik: " + error.message);

        closeModal('order-modal');
        await refreshDataAndRender('orders');
    });
};

window.openTransferModal = (sourceType) => {
    // sourceType can be 'ordered', 'customs', or 'instock'
    let availableCars = globalDB.cars.filter(c => c.status === sourceType);
    
    // Unique modellar va trimlarni chiqarish (filter uchun)
    const uniqueModels = [...new Set(availableCars.map(c => c.model).filter(Boolean))].sort();
    const uniqueTrims  = [...new Set(availableCars.map(c => c.trim).filter(Boolean))].sort();

    const dealersOptions = globalDB.dealerships.map(d => `<option value="dealer_${d.id}">${d.name}</option>`).join('');
    
    let destHtml = "";
    if (sourceType === 'ordered') {
        destHtml = `<option value="customs">Bojxona (Tamojnya) Ombori</option>`;
    } else if (sourceType === 'customs') {
        destHtml = dealersOptions;
    } else {
        destHtml = dealersOptions;
    }

    const sourceLabel = sourceType === 'ordered' ? 'Xitoy Buyurtmalari' : (sourceType === 'customs' ? 'Bojxona' : 'Ombor');

    const modalHtml = `
        <div class="modal-overlay" id="transfer-modal">
            <div class="modal-content" style="max-width: 760px; width: 97%;">
                <div class="modal-header">
                    <h3><i class="ph ph-arrows-left-right" style="color:var(--accent-color); margin-right:8px;"></i>Avtomobillarni Ko'chirish (Transfer)</h3>
                    <button class="close-btn" onclick="closeModal('transfer-modal')"><i class="ph ph-x"></i></button>
                </div>
                
                <form id="transfer-form">
                    <!-- Manzillar -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom:1rem;">
                        <div class="input-group">
                            <label>Qayerdan</label>
                            <input type="text" value="${sourceLabel}" disabled style="background: rgba(255,255,255,0.05); color: var(--text-muted);">
                            <input type="hidden" id="tr-source" value="${sourceType}">
                        </div>
                        <div class="input-group">
                            <label>Qayerga yuborilsin? <span style="color:#ef4444">*</span></label>
                            <select id="tr-dest" required>
                                <option value="">-- Manzilni tanlang --</option>
                                ${destHtml}
                            </select>
                        </div>
                    </div>

                    <!-- Filterlar qatori -->
                    <div style="display:grid; grid-template-columns: 1.5fr 1fr 1fr; gap:.75rem; margin-bottom:.75rem; align-items:end;">
                        <div class="input-group" style="margin:0;">
                            <label style="font-size:.82rem;"><i class="ph ph-magnifying-glass" style="margin-right:4px;"></i>VIN bo'yicha qidirish (oxirgi 4 raqam)</label>
                            <input type="text" id="tr-search" placeholder="Masalan: 3421" maxlength="17"
                                oninput="window.filterTransferCars()"
                                style="font-family:monospace; letter-spacing:.05em;">
                        </div>
                        <div class="input-group" style="margin:0;">
                            <label style="font-size:.82rem;"><i class="ph ph-car" style="margin-right:4px;"></i>Model</label>
                            <select id="tr-filter-model" onchange="window.filterTransferCars()">
                                <option value="">Barcha modellar</option>
                                ${uniqueModels.map(m => `<option value="${m}">${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group" style="margin:0;">
                            <label style="font-size:.82rem;"><i class="ph ph-sliders" style="margin-right:4px;"></i>Komplektatsiya</label>
                            <select id="tr-filter-trim" onchange="window.filterTransferCars()">
                                <option value="">Barcha komp.</option>
                                ${uniqueTrims.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Tanlov uchun amallar -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:.85rem;">
                        <div style="display:flex; gap:1rem;">
                            <a href="#" onclick="window._trSelectAll(true); event.preventDefault();" style="color:var(--accent-color); text-decoration:none;"><i class="ph ph-check-square"></i> Barchasini tanlash</a>
                            <a href="#" onclick="window._trSelectAll(false); event.preventDefault();" style="color:var(--text-muted); text-decoration:none;"><i class="ph ph-square"></i> Tanlashni bekor qilish</a>
                        </div>
                        <span id="tr-selected-count" style="color:var(--accent-color); font-weight:700;">0 ta tanlangan</span>
                    </div>

                    <!-- Ro'yhat -->
                    <div style="max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.25); border-radius: 10px; border:1px solid rgba(255,255,255,.07);" id="tr-cars-list">
                        ${availableCars.length === 0
                            ? '<div style="padding: 30px; text-align: center; color: var(--text-muted);"><i class="ph ph-car" style="font-size:2rem;"></i><br>Mashinalar topilmadi</div>'
                            : availableCars.map(c => `
                            <label class="tr-car-row" data-model="${(c.model||'').toLowerCase()}" data-trim="${(c.trim||'').toLowerCase()}" data-vin="${(c.vin||'').toLowerCase()}"
                                style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; transition:.15s;"
                                onmouseover="this.style.background='rgba(99,102,241,.08)'" onmouseout="this.style.background=''"
                            >
                                <input type="checkbox" name="tr_car" value="${c.id}" class="tr-checkbox" style="width:17px; height:17px; flex-shrink:0;" onchange="window._trUpdateCount()">
                                <div style="flex:1; min-width:0;">
                                    <strong>${c.model || '-'}</strong>
                                    <span style="color:var(--text-muted); font-size:.82rem; margin-left:6px;">${c.trim || ''}</span>
                                    <div style="font-size:.78rem; color:var(--text-muted); margin-top:2px;">
                                        ${c.color_ext ? '🎨 '+c.color_ext : ''}
                                        ${c.fuel ? ' &bull; ⚡ '+c.fuel : ''}
                                    </div>
                                </div>
                                <div style="font-family:monospace; font-size:.84rem; color:${c.vin ? '#a5b4fc' : 'var(--text-muted)'}; white-space:nowrap; flex-shrink:0;">
                                    ${c.vin ? c.vin : '<span style="color:var(--text-muted)">VIN yo\'q</span>'}
                                </div>
                                <div style="font-size:.82rem; color:#10b981; white-space:nowrap; flex-shrink:0;">
                                    $${(c.final_cost||0).toLocaleString()}
                                </div>
                            </label>
                        `).join('')}
                    </div>

                    ${sourceType === 'ordered' ? `
                    <div class="input-group mt-3">
                        <label>Bojxona xarajatlari va Yetkazish ($) &mdash; tanlanganlarning <em>barchasiga</em> qo'llanadi</label>
                        <input type="number" id="tr-extra-fee" placeholder="Masalan: 1500" required>
                    </div>
                    ` : ''}

                    <div class="text-right mt-4 flex-gap" style="justify-content:flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('transfer-modal')">Bekor qilish</button>
                        <button type="submit" class="btn btn-primary" style="background:var(--accent-color); border-color:var(--accent-color);">
                            <i class="ph ph-truck"></i> Tanlanganlarni Jo'natish
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ---- Yordamchi funksiyalar ----
    window._trSelectAll = (checked) => {
        document.querySelectorAll('.tr-car-row:not([style*="display: none"]) .tr-checkbox').forEach(cb => cb.checked = checked);
        window._trUpdateCount();
    };
    window._trUpdateCount = () => {
        const n = document.querySelectorAll('.tr-checkbox:checked').length;
        const el = document.getElementById('tr-selected-count');
        if(el) el.textContent = n + ' ta tanlangan';
    };

    document.getElementById('transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const source = document.getElementById('tr-source').value;
        const dest   = document.getElementById('tr-dest').value;
        const checkboxes = document.querySelectorAll('.tr-checkbox:checked');
        
        let checkedIds = [];
        checkboxes.forEach(cb => checkedIds.push(parseInt(cb.value)));
        
        if(!dest) { alert("Iltimos, manzilni tanlang!"); return; }
        if(checkedIds.length === 0) { alert("Yuborish uchun hech qanday mashina tanlanmadi!"); return; }

        let updateData = {};
        if (dest === 'customs') {
            const extra = parseFloat(document.getElementById('tr-extra-fee').value) || 0;
            for(let id of checkedIds) {
                const c = globalDB.cars.find(x => x.id === id);
                await _supabase.from('cars').update({
                    status: 'customs', location: 'customs',
                    extra: extra, final_cost: (c.factory_price || 0) + extra
                }).eq('id', id);
            }
        } else if (dest.startsWith('dealer_')) {
            updateData = { status: 'instock', location: dest };
            const { error } = await _supabase.from('cars').update(updateData).in('id', checkedIds);
            if(error) { alert("Xato: " + error.message); return; }
        }

        const destName = globalDB.dealerships.find(d => 'dealer_'+d.id === dest)?.name || dest;
        alert(`✅ ${checkedIds.length} ta avtomobil "${destName}" ga muvaffaqiyatli ko'chirildi!`);
        closeModal('transfer-modal');
        const viewMap = { ordered: 'orders', customs: 'customs', instock: 'inventory' };
        await refreshDataAndRender(viewMap[source] || source);
    });
};

window.filterTransferCars = () => {
    const vinTerm   = (document.getElementById('tr-search')?.value || '').trim().toLowerCase();
    const modelTerm = (document.getElementById('tr-filter-model')?.value || '').toLowerCase();
    const trimTerm  = (document.getElementById('tr-filter-trim')?.value || '').toLowerCase();

    const rows = document.querySelectorAll('#tr-cars-list .tr-car-row');
    rows.forEach(row => {
        const rowVin   = (row.dataset.vin || '').toLowerCase();
        const rowModel = (row.dataset.model || '').toLowerCase();
        const rowTrim  = (row.dataset.trim || '').toLowerCase();

        // VIN qidirish: oxirgi 4 ta belgiga mos kelishi YOKI to'liq qatorga mos kelishi
        let vinMatch = true;
        if (vinTerm) {
            if (vinTerm.length <= 4) {
                // Oxirgi N ta raqamlarni tekshiramiz
                vinMatch = rowVin.endsWith(vinTerm);
            } else {
                // To'liq qidirish
                vinMatch = rowVin.includes(vinTerm);
            }
        }

        const modelMatch = !modelTerm || rowModel === modelTerm;
        const trimMatch  = !trimTerm  || rowTrim === trimTerm;

        const visible = vinMatch && modelMatch && trimMatch;
        row.style.display = visible ? 'flex' : 'none';
    });

    window._trUpdateCount();
}


window.openSaleModal = (carId) => {
    const car = globalDB.cars.find(c => c.id === carId);

    const modalHtml = `
        <div class="modal-overlay" id="sale-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Yangi Sotuv yaratish</h3>
                    <button class="close-btn" onclick="closeModal('sale-modal')"><i class="ph ph-x"></i></button>
                </div>
                <div class="mb-4 text-muted">Sotilayotgan avto: <strong>${car.model} (VIN: ${car.vin})</strong></div>
                <form id="new-sale-form">
                    <div class="input-group">
                        <label>Telefon raqam</label>
                        <input type="text" id="sale-phone" required placeholder="+998901234567" oninput="window.checkCustomerPhone()">
                    </div>
                    <div class="input-group mt-2">
                        <label>Mijoz F.I.Sh</label>
                        <input type="text" id="sale-customer" required placeholder="To'liq ismi...">
                    </div>
                    <div class="input-group mt-2">
                        <label>Pasport seriyasi / JSHSHIR</label>
                        <input type="text" id="sale-passport" placeholder="AA1234567 / 31234567890123">
                    </div>
                    <div class="input-group mt-2">
                        <label>Manzili (Ixtiyoriy)</label>
                        <input type="text" id="sale-address" placeholder="Toshkent, Yunusobod...">
                    </div>
                    
                    <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin: 15px 0;">
                    
                    <div class="input-group mt-2">
                        <label>To'lov Turi</label>
                        <select id="sale-type" required>
                            <option value="cash">Naqd To'lov</option>
                            <option value="realization">Nasiya (Realizatsiya qarziga)</option>
                        </select>
                    </div>
                    <div class="input-group mt-2">
                        <label>Sotilgan Narxi ($)</label>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">
                            Eslatma: Avto uchun sebestoimost $${car.final_cost || 0} ga tushgan.
                        </p>
                        <input type="number" id="sale-price" value="${car.final_cost > 0 ? car.final_cost + 2000 : 25000}" required>
                    </div>
                    <div class="text-right mt-4 flex-gap" style="justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('sale-modal')">Oqaga</button>
                        <button type="submit" class="btn btn-primary">Savdoni tasdiqlash va PDF Shartnoma</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('new-sale-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phone = document.getElementById('sale-phone').value;
        const name = document.getElementById('sale-customer').value;
        const passport = document.getElementById('sale-passport').value;
        const address = document.getElementById('sale-address').value;
        const type = document.getElementById('sale-type').value;
        const price = parseInt(document.getElementById('sale-price').value);
        
        let targetCustomer = globalDB.customers.find(c => c.phone === phone);
        
        // 1. Mijozni tekshiramiz va saqlaymiz
        if (!targetCustomer) {
            targetCustomer = {
                // id will be generated by Supabase
                full_name: name,
                phone: phone,
                passport: passport,
                address: address,
                dealer_id: currentUser.dealership_id || null
            };
            const cRes = await _supabase.from('customers').insert(targetCustomer).select();
            if(cRes.error) {
                alert("Mijozni saqlashda xato: " + cRes.error.message);
                return;
            }
            if(cRes.data && cRes.data.length > 0) targetCustomer = cRes.data[0];
        }
        
        // 2. Update Car Status
        await _supabase.from('cars').update({
            status: 'sold',
            price: price
        }).eq('id', carId);

        // 3. Insert Sale record
        const { error } = await _supabase.from('sales').insert({
            id: Date.now() + Math.floor(Math.random() * 1000000),
            car_id: car.id,
            vin: car.vin,
            car_model: car.model,
            dealer_id: currentUser.dealership_id || 1, // Admin bo'lsa diler 1 ni oladi
            payment_type: type,
            customer_name: targetCustomer.full_name,
            price: price
        });
        
        if(error) alert("Sotuvni qo'shishda xato: " + error.message);
        
        closeModal('sale-modal');
        alert("Sotuv omadli bo'ldi!");
        
        // PDF Generatsiya!
        generateInvoicePDF({
            car_model: car.model,
            vin: car.vin,
            price: price,
            date: new Date().toLocaleDateString('uz-UZ'),
            customer_name: targetCustomer.full_name,
            payment_type: type === 'cash' ? "Naqd To'lov" : "Nasiya (Bo'lib to'lash)"
        });
        
        await refreshDataAndRender('inventory');
    });
}

window.checkCustomerPhone = () => {
    const el = document.getElementById('sale-phone');
    if (!el) return;
    const val = el.value.trim();
    if(val.length > 5) {
        let exists = globalDB.customers.find(c => c.phone.includes(val));
        if (exists) {
            document.getElementById('sale-customer').value = exists.full_name;
            document.getElementById('sale-passport').value = exists.passport || '';
            document.getElementById('sale-address').value = exists.address || '';
        }
    }
}

window.generateInvoicePDF = (sale) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Green tint
    doc.text("EVOLUTION MOTORS", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Rasmiy To'lov Cheki / Shartnoma", 105, 30, { align: "center" });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    // Customer info
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("Mijoz F.I.Sh: ", 20, 50);
    doc.setFont("helvetica", "bold");
    doc.text(sale.customer_name, 60, 50);
    
    doc.setFont("helvetica", "normal");
    doc.text("Sana: ", 20, 60);
    doc.text(sale.date, 60, 60);
    
    // Order info box
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(20, 70, 170, 60, 3, 3, "F");
    
    doc.text("Sotib olingan avtomobil:", 25, 80);
    doc.setFont("helvetica", "bold");
    doc.text(sale.car_model, 85, 80);
    
    doc.setFont("helvetica", "normal");
    doc.text("VIN Kodi:", 25, 95);
    doc.setFont("courier", "bold");
    doc.text(sale.vin, 85, 95);
    
    doc.setFont("helvetica", "normal");
    doc.text("To'lov turi:", 25, 110);
    doc.text(sale.payment_type, 85, 110);
    
    doc.text("Jami summa:", 25, 125);
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text("$" + sale.price.toLocaleString(), 85, 125);
    
    // Bottom
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("--------------------------------------------", 20, 160);
    doc.text("Imzo (Mijoz):", 20, 165);
    
    doc.text("--------------------------------------------", 130, 160);
    doc.text("Imzo (Sotuvchi):", 130, 165);
    
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text("Ushbu chek AutoCRM tizimi tomonidan avtomatik generatsiya qilindi.", 105, 190, { align: "center" });

    doc.save("Shartnoma_" + sale.customer_name.replace(/ /g, "_") + ".pdf");
}

window.toggleCarSelection = (carId, event) => {
    if (event.target.checked) selectedCars.add(carId);
    else selectedCars.delete(carId);
}

window.toggleAllCars = (event, statusType) => {
    const isChecked = event.target.checked;
    const carsList = globalDB.cars.filter(c => c.status === statusType);
    
    if (statusType === 'instock' && currentUser.role === 'dealer') {
        // qisqartiish
    }
    
    carsList.forEach(c => {
        if(isChecked) selectedCars.add(c.id);
        else selectedCars.delete(c.id);
    });
    
    document.querySelectorAll('.car-select').forEach(cb => cb.checked = isChecked);
}

window.deleteSelected = async () => {
    if (selectedCars.size === 0) {
        alert("O'chirish uchun avtomobil belgilanmagan!");
        return;
    }
    if(confirm(selectedCars.size + " ta belgilangan qatorni butunlay o'chirib yuborasizmi?")) {
        const idArray = Array.from(selectedCars);
        const { error } = await _supabase.from('cars').delete().in('id', idArray);
        if (error) {
            alert("Xatolik: " + error.message);
        } else {
            alert("Muvaffaqiyatli o'chirildi!");
            selectedCars.clear();
            const currentView = document.querySelector('.nav-item.active').getAttribute('data-view');
            await refreshDataAndRender(currentView);
        }
    }
}

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.remove();
}
