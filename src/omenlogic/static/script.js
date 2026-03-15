// --- CONFIGURATION ---
// Using relative path so it works in Docker and Localhost automatically
const API_BASE = "/api";

let localBankData = {};

const themes = {
    'B1': { color: '#005b96', icon: 'fa-building' },
    'B2': { color: '#c0392b', icon: 'fa-chart-area' },
    'B3': { color: '#8e44ad', icon: 'fa-gem' },
    'B4': { color: '#27ae60', icon: 'fa-leaf' },
    'B5': { color: '#f39c12', icon: 'fa-landmark' }
};

// --- 1. INITIALIZE PORTAL ---
async function initPortal() {
    try {
        const res = await fetch(`${API_BASE}/portal`);
        if (!res.ok) throw new Error("Could not reach API");

        const data = await res.json();
        let html = '';

        data.banks.forEach(b => {
            const t = themes[b.bankId] || themes['B1'];
            html += `
                <div class="bank-card" onclick="loginBank('${b.bankId}')">
                    <i class="fas ${t.icon}" style="color:${t.color}; font-size:3rem; margin-bottom:15px;"></i>
                    <h2 style="margin:0; letter-spacing:1px;">${b.bankName}</h2>
                    <p style="margin:5px 0 0 0; color:#a2a3b7; font-size:0.9rem;">Mgr: ${b.managerName}</p>
                </div>`;
        });
        document.getElementById('portal-grid').innerHTML = html;
    } catch (err) {
        console.error("Portal Init Error:", err);
        document.getElementById('portal-grid').innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:#ff6b6b; margin-bottom:15px;"></i>
                <p style="color:#ff6b6b; font-weight:bold; margin:0;">API Connection Failed</p>
                <p style="color:#a2a3b7; font-size:0.85rem;">Ensure the FastAPI server is running.</p>
            </div>`;
    }
}

// --- 2. LOGIN & DATA PREPARATION ---
async function loginBank(bankId) {
    try {
        const t = themes[bankId] || themes['B1'];
        document.documentElement.style.setProperty('--secondary', t.color);

        // Slide the login portal up
        document.getElementById('login-portal').style.transform = 'translateY(-100%)';

        const res = await fetch(`${API_BASE}/bank/${bankId}`);
        const d = await res.json();

        document.getElementById('ui-bank-name').innerText = d.bank_name;
        document.getElementById('ui-manager-name').innerText = d.manager;
        document.getElementById('kpi-total').innerText = d.total;

        // Reset and generate local synthetic fields
        localBankData = {};
        d.all_customers.forEach(r => {
            localBankData[r.customerId] = {
                ...r,
                accNo: 'ACC-' + Math.floor(100000000 + Math.random() * 900000000),
                creditScore: Math.floor(580 + Math.random() * 270),
                hasCard: Math.random() > 0.3 ? 'Yes' : 'No',
                isActive: Math.random() > 0.4 ? 'Active' : 'Inactive',
                scanned: false,
                realProb: null
            };
        });

        renderTable();
        updateDynamicKPIs();
    } catch (err) {
        alert("Failed to load bank data. Check console for details.");
        logout();
    }
}

// --- 3. RENDER CUSTOMER TABLE ---
function renderTable() {
    let html = '';
    Object.values(localBankData).forEach(c => {
        let statusBadge = `<span class="badge bg-pending"><i class="fas fa-clock"></i> Pending Scan</span>`;
        let actionBtn = `<button class="btn-run" id="btn-${c.customerId}" onclick="runPrediction('${c.customerId}')"><i class="fas fa-brain"></i> Predict</button>`;

        if (c.scanned) {
            const type = c.realProb > 50 ? 'danger' : 'success';
            const text = c.realProb > 50 ? 'High Risk' : 'Stable';
            statusBadge = `<span class="badge bg-${type}">${c.realProb}% - ${text}</span>`;
            actionBtn = `<button class="btn-run" style="background:#f3f6f9; color:var(--text-main);" onclick="openC360('${c.customerId}')"><i class="fas fa-folder-open"></i> Profile</button>`;
        }

        html += `
            <tr>
                <td><strong>${c.name}</strong><span class="cust-meta">ID: ${c.customerId}</span></td>
                <td>${c.accNo}<span class="cust-meta">Active: ${c.isActive} | CC: ${c.hasCard}</span></td>
                <td>$${c.monthlyCharges} /mo<span class="cust-meta">Tenure: ${c.tenure} mos</span></td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>`;
    });
    document.getElementById('dash-table-body').innerHTML = html;
}

// --- 4. TRIGGER AI PREDICTION ---
async function runPrediction(custId) {
    const btn = document.getElementById(`btn-${custId}`);
    const originalContent = btn.innerHTML;

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Running...`;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/analyze/${custId}`);
        if (!res.ok) throw new Error("Prediction API Error");

        const data = await res.json();

        // Update local state with real AI results
        localBankData[custId].scanned = true;
        localBankData[custId].realProb = data.prob;

        renderTable();
        updateDynamicKPIs();
        openC360(custId);
    } catch (err) {
        console.error("AI Error:", err);
        alert("AI Prediction Failed. Ensure TensorFlow is correctly loaded in the backend.");
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- 5. CUSTOMER 360 VIEW ---
function openC360(custId) {
    const c = localBankData[custId];
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-detail').classList.add('active');

    const isRisk = c.realProb > 50;
    const colorClass = isRisk ? 'danger' : 'success';
    const riskText = isRisk ? 'CRITICAL FLIGHT RISK' : 'SECURE / STABLE';

    document.getElementById('detail-content').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h1 style="margin:0; font-size: 1.8rem; color: var(--primary)">${c.name}</h1>
                <span class="cust-meta" style="font-size: 0.9rem;">Account: ${c.accNo} | System ID: ${c.customerId}</span>
            </div>
            <div><span class="badge bg-${colorClass}" style="font-size: 1rem; padding: 10px 20px;">${riskText}</span></div>
        </div>
        
        <div class="c360-grid">
            <div class="c360-card">
                <h4>Banking Details</h4>
                <div class="data-row"><span>Credit Score:</span> <span>${c.creditScore}</span></div>
                <div class="data-row"><span>Credit Card:</span> <span>${c.hasCard}</span></div>
                <div class="data-row"><span>Active Member:</span> <span>${c.isActive}</span></div>
            </div>
            
            <div class="c360-card">
                <h4>Account Usage</h4>
                <div class="data-row"><span>Monthly Billing:</span> <span>$${c.monthlyCharges}</span></div>
                <div class="data-row"><span>Tenure:</span> <span>${c.tenure} Months</span></div>
                <div class="data-row"><span>Support Tickets:</span> <span>${c.supportCalls || 0}</span></div>
            </div>
            
            <div class="c360-card" style="border-top: 4px solid var(--${colorClass});">
                <h4 style="text-align:center;">NNDL AI Prediction</h4>
                <div class="gauge-wrapper">
                    <h1 style="margin:0; font-size:3rem; color: var(--${colorClass})">${c.realProb}%</h1>
                    <p style="margin: 5px 0 15px 0; color:var(--text-muted); font-size:0.85rem;">Probability of Churn</p>
                    <div class="gauge-bar">
                        <div class="gauge-fill" style="background: var(--${colorClass}); width: 0%; transition: width 1s ease-out;" id="c360-gauge"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Animate the gauge
    setTimeout(() => {
        const gauge = document.getElementById('c360-gauge');
        if (gauge) gauge.style.width = c.realProb + '%';
    }, 100);
}

// --- 6. UPDATE DASHBOARD KPIs ---
function updateDynamicKPIs() {
    let scanned = 0, risk = 0, safe = 0;
    Object.values(localBankData).forEach(c => {
        if (c.scanned) {
            scanned++;
            if (c.realProb > 50) risk++; else safe++;
        }
    });
    document.getElementById('kpi-scanned').innerText = scanned;
    document.getElementById('kpi-risk').innerText = risk;
    document.getElementById('kpi-safe').innerText = safe;
}

// --- NAVIGATION UTILS ---
function switchTab(tab, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(`view-${tab}`);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function closeDetail() {
    switchTab('dashboard', document.querySelectorAll('.nav-item')[0]);
}

function logout() {
    document.getElementById('login-portal').style.transform = 'translateY(0)';
}

// Start Application
initPortal();
