// AutoCRM - Asosiy mantiq (JavaScript)
// Izoh: Ushbu versiya to'liq orqa backend - SUPABASE ga ulangan.

const supabaseUrl = 'https://xyubrbbvjufifrilrbab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dWJyYmJ2anVmaWZyaWxyYmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTUxMzksImV4cCI6MjA5MTczMTEzOX0.UwBygN8dBeMu-dhAERuLFjzAlH5DsTaum_SwxsnbYa4';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- Holat (State) ---
let currentUser = null;
let globalDB = { users: [], dealerships: [], cars: [], sales: [] };

// --- Bazani yangilash ---
const refreshDB = async () => {
    try {
        const [u, d, c, s] = await Promise.all([
            _supabase.from('users').select('*'),
            _supabase.from('dealerships').select('*'),
            _supabase.from('cars').select('*').order('id', {ascending: false}),
            _supabase.from('sales').select('*').order('date', {ascending: false})
        ]);
        
        if (u.error) alert("Supabase ga ulanishda xato: " + u.error.message);
        
        globalDB.users = u.data || [];
        globalDB.dealerships = d.data || [];
        globalDB.cars = c.data || [];
        globalDB.sales = s.data || [];
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
            refreshDataAndRender(item.getAttribute('data-view')); // Har gal bosganda bazani yangilaymiz!
        });
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
    });
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
        const totalChina = db.cars.filter(c => c.status === 'ordered').length;
        const totalCustoms = db.cars.filter(c => c.status === 'customs').length;
        const totalDealers = db.cars.filter(c => c.status === 'instock').length;
        const totalSales = db.cars.filter(c => c.status === 'sold').length;
        const totalLimit = totalChina + totalCustoms + totalDealers + totalSales;
        
        let pChina = totalLimit ? Math.round((totalChina / totalLimit) * 100) : 0;
        let pCustoms = totalLimit ? Math.round((totalCustoms / totalLimit) * 100) : 0;
        let pDealers = totalLimit ? Math.round((totalDealers / totalLimit) * 100) : 0;
        let pSales = totalLimit ? Math.round((totalSales / totalLimit) * 100) : 0;

        html = `
            <div class="view-header">
                <h1>Asosiy Panel (Boshqaruv) - Supabase Baza ulangan! 🟢</h1>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-title">Xitoyda (Zavod)</div>
                    <div class="stat-value">${totalChina} ta</div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pChina}%; background: #6366f1;"></div></div>
                    <div class="stat-subtitle"><span>Umumiy hajmdan</span> <span>${pChina}%</span></div>
                    <i class="ph ph-factory stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Bojxonada (Tamojnya)</div>
                    <div class="stat-value text-warning">${totalCustoms} ta</div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pCustoms}%; background: #f59e0b;"></div></div>
                    <div class="stat-subtitle"><span>Umumiy hajmdan</span> <span>${pCustoms}%</span></div>
                    <i class="ph ph-truck stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Dilerlar omborida</div>
                    <div class="stat-value text-success">${totalDealers} ta</div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pDealers}%; background: #10b981;"></div></div>
                    <div class="stat-subtitle"><span>Umumiy hajmdan</span> <span>${pDealers}%</span></div>
                    <i class="ph ph-storefront stat-icon"></i>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Jami Sotuvlar</div>
                    <div class="stat-value text-accent">${totalSales} ta</div>
                    <div class="progress-container"><div class="progress-bar" style="width: ${pSales}%; background: #ef4444;"></div></div>
                    <div class="stat-subtitle"><span>Umumiy hajmdan</span> <span>${pSales}%</span></div>
                    <i class="ph ph-currency-circle-dollar stat-icon"></i>
                </div>
            </div>
        `;
    } 
    else if (viewId === 'orders') {
        const chinaCars = db.cars.filter(c => c.status === 'ordered');
        html = `
            <div class="view-header">
                <h1>Xitoydan kelayotgan</h1>
                <div class="flex-gap">
                    <button class="btn btn-secondary" onclick="downloadShablon()">📄 Shablon Yuklash (Excel)</button>
                    <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
                        <i class="ph ph-upload-simple"></i> Exceldan Yuklash
                        <input type="file" id="excel-upload-orders" accept=".xlsx, .xls" class="hidden" onchange="uploadExcel(event, 'ordered')">
                    </label>
                    <button class="btn btn-primary" onclick="openOrderModal()"><i class="ph ph-plus"></i> Qo'lda Qo'shish</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Model (Komp)</th>
                            <th>Kuzov/Salon</th>
                            <th>Zavod Narx</th>
                            <th>Holati</th>
                            <th>Amaliyot</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chinaCars.map(c => `
                            <tr>
                                <td><strong>${c.model}</strong> (${c.trim || 'Basic'})</td>
                                <td>${c.color_ext || '-'} / ${c.color_int || '-'}</td>
                                <td>$${c.factory_price || 0}</td>
                                <td><span class="badge status-ordered">Ishlab chiqarilmoqda</span></td>
                                <td><button class="btn btn-secondary btn-sm" onclick="moveToCustoms(${c.id})">Bojxonaga tushdi</button></td>
                            </tr>
                        `).join('')}
                        ${chinaCars.length === 0 ? "<tr><td colspan='5'>Buyurtmalar yo'q.</td></tr>" : ""}
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
                    <button class="btn btn-secondary" onclick="downloadShablon()">📄 Shablon Yuklash (Excel)</button>
                    <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
                        <i class="ph ph-upload-simple"></i> Bojxona Omboriga Exceldan qabul
                        <input type="file" id="excel-upload-customs" accept=".xlsx, .xls" class="hidden" onchange="uploadExcel(event, 'customs')">
                    </label>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Model</th>
                            <th>VIN Kod</th>
                            <th>Narx (Sebestoimost)</th>
                            <th>Holati</th>
                            <th>Dilerga biriktirish</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customCars.map(c => `
                            <tr>
                                <td><strong>${c.model}</strong></td>
                                <td><span style="font-family: monospace;">${c.vin || 'VIN kiritilmagan'}</span></td>
                                <td>$${c.final_cost || 0}</td>
                                <td><span class="badge status-customs">Bojxonada saqlanmoqda</span></td>
                                <td class="flex-gap">
                                    <select id="assign_select_${c.id}" style="width: 150px; padding: 0.4rem;">
                                        <option value="">-- Diler Tanlang --</option>
                                        ${dealersOptions}
                                    </select>
                                    <button class="btn btn-primary" onclick="assignToDealer(${c.id})" style="padding: 0.4rem 1rem;">O'tkazish</button>
                                </td>
                            </tr>
                        `).join('')}
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
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Model (Yoqilg'i)</th>
                            <th>VIN Kod</th>
                            <th>Rangi (Kuzov)</th>
                            ${currentUser.role === 'admin' ? "<th>Diler Nomi</th>" : ""}
                            <th>Holati</th>
                            <th>Savdo qilish</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myCars.map(c => `
                            <tr>
                                <td><strong>${c.model}</strong> (${c.fuel || 'N/A'})</td>
                                <td><span style="font-family: monospace;">${c.vin}</span></td>
                                <td>${c.color_ext || '-'}</td>
                                ${currentUser.role === 'admin' ? `<td>${db.dealerships.find(d => 'dealer_'+d.id === c.location)?.name || 'Noma\`lum'}</td>` : ""}
                                <td><span class="badge status-instock">Sotuvda mavjud</span></td>
                                <td><button class="btn btn-primary" onclick="openSaleModal(${c.id})"><i class="ph ph-shopping-cart"></i> Sotish qatorini ochish</button></td>
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

    area.innerHTML = html;
};

// --- Modal & Utility Functions ---
window.downloadShablon = () => {
    const ws_data = [
        ["Mashina", "Komplektatsiya", "Yoqilg'i turi", "VIN_Kod", "Kuzov_Rangi", "Salon_Rangi", "Zavod_Narxi", "Qoshimcha_Rasxod", "Yakuniy_Sebestoimost"],
        ["C16", "Full", "Gibrid", "", "Oq", "Qora", "24000", "0", "24000"],
        ["C11", "Basic", "Elektro", "LXV23000981...", "Qora", "Jigarrang", "21000", "500", "21500"]
    ];
    var ws = XLSX.utils.aoa_to_sheet(ws_data);
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

        json.forEach(row => {
            const factPrice = parseFloat(row["Zavod_Narxi"]) || 0;
            const extra = parseFloat(row["Qoshimcha_Rasxod"]) || 0;
            rowsToInsert.push({
                id: Date.now() + Math.floor(Math.random() * 1000000), // Unique ID for supabase BIGINT
                model: row["Mashina"] || 'Noma`lum',
                trim: row["Komplektatsiya"] || '',
                fuel: row["Yoqilg'i turi"] || '',
                color_ext: row["Kuzov_Rangi"] || '',
                color_int: row["Salon_Rangi"] || '',
                vin: row["VIN_Kod"] || '', 
                status: targetStatus,
                location: targetStatus === 'ordered' ? 'china' : 'customs',
                factory_price: factPrice,
                extra: extra,
                final_cost: parseFloat(row["Yakuniy_Sebestoimost"]) || (factPrice + extra),
                price: parseFloat(row["Yakuniy_Sebestoimost"]) + 2000 || 25000
            });
            loadedCount++;
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

window.moveToCustoms = async (carId) => {
    const vin = prompt("Bojxonaga yetib keldi. Aynan ushbu mashinaning VIN kodini kiriting:");
    if (vin) {
        const extraRaw = prompt("Tamojnya va boshqa xarajatlar summasi ($):", "1500");
        if(extraRaw !== null) {
            const extra = parseFloat(extraRaw);
            const car = globalDB.cars.find(c => c.id === carId);
            const updatedCar = {
                status: 'customs', 
                location: 'customs', 
                vin: vin.toUpperCase(),
                extra: isNaN(extra) ? 0 : extra,
                final_cost: (car.factory_price || 0) + (isNaN(extra) ? 0 : extra)
            };
            
            const { error } = await _supabase.from('cars').update(updatedCar).eq('id', carId);
            if(error) alert("Xato: " + error.message);
            await refreshDataAndRender('orders');
        }
    }
}

window.assignToDealer = async (carId) => {
    const dilerVal = document.getElementById('assign_select_'+carId).value;
    if(!dilerVal) { alert("Dilerni tanlang!"); return; }
    
    // dilerVal = 'dealer_1' or 'dealer_2'
    const { error } = await _supabase.from('cars').update({
        status: 'instock',
        location: dilerVal
    }).eq('id', carId);
    
    if(error) alert("Xato: " + error.message);
    else {
        alert("Avtomobil muvaffaqiyatli diler omboriga yo'naltirildi!");
        await refreshDataAndRender('customs');
    }
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
                        <label>Mijoz F.I.Sh</label>
                        <input type="text" id="sale-customer" required placeholder="To'liq ismi...">
                    </div>
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
                        <button type="submit" class="btn btn-primary">Ombordan chiqarish va Sotish</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('new-sale-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const customer = document.getElementById('sale-customer').value;
        const type = document.getElementById('sale-type').value;
        const price = parseInt(document.getElementById('sale-price').value);
        
        // 1. Update Car Status
        await _supabase.from('cars').update({
            status: 'sold',
            price: price
        }).eq('id', carId);

        // 2. Insert Sale record
        const { error } = await _supabase.from('sales').insert({
            id: Date.now() + Math.floor(Math.random() * 1000000),
            car_id: car.id,
            vin: car.vin,
            car_model: car.model,
            dealer_id: currentUser.dealership_id || 1, // Admin bo'lsa diler 1 ni oladi
            payment_type: type,
            customer_name: customer,
            price: price
        });
        
        if(error) alert("Sotuvni qo'shishda xato: " + error.message);
        
        closeModal('sale-modal');
        alert("Sotuv omadli bo'ldi! Avto ombordan o'chirildi.");
        await refreshDataAndRender('inventory');
    });
}

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.remove();
}
