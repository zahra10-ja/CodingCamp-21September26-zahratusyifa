/* =========================================================
   Expense & Budget Visualizer — app.js
   ========================================================= */

'use strict';

/* ── Constants ──────────────────────────────────────────── */
const STORAGE_KEY = 'ebv_transactions';

const CATEGORY_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

const CATEGORY_EMOJI = {
  Food:      '🍔',
  Transport: '🚌',
  Fun:       '🎉',
};

/* ── State ──────────────────────────────────────────────── */
let transactions = loadFromStorage();
let chartInstance = null;
let currentSort = 'date-desc';

/* ── DOM References ─────────────────────────────────────── */
const form          = document.getElementById('expense-form');
const inputName     = document.getElementById('item-name');
const inputAmount   = document.getElementById('item-amount');
const inputCategory = document.getElementById('item-category');

const errName     = document.getElementById('err-name');
const errAmount   = document.getElementById('err-amount');
const errCategory = document.getElementById('err-category');

const totalBalanceEl    = document.getElementById('total-balance');
const transactionListEl = document.getElementById('transaction-list');
const transactionCount  = document.getElementById('transaction-count');
const emptyState        = document.getElementById('empty-state');
const chartCanvas       = document.getElementById('expense-chart');
const chartEmptyMsg     = document.getElementById('chart-empty-msg');

const themeToggleBtn    = document.getElementById('theme-toggle');

const sortSelect = document.getElementById('sort-select');

const monthTotalEl        = document.getElementById('month-total');
const monthCountEl        = document.getElementById('month-count');
const monthTopCategoryEl  = document.getElementById('month-top-category');

/* ── Storage Helpers ────────────────────────────────────── */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
/* ── Theme Toggle ───────────────────────────────────────── */
const THEME_KEY = 'ebv_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ── Form Validation ────────────────────────────────────── */
function clearErrors() {
  [errName, errAmount, errCategory].forEach(el => (el.textContent = ''));
  [inputName, inputAmount, inputCategory].forEach(el => el.classList.remove('invalid'));
}

function validateForm() {
  let valid = true;

  if (!inputName.value.trim()) {
    errName.textContent = 'Item name is required.';
    inputName.classList.add('invalid');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value || isNaN(amt) || amt <= 0) {
    errAmount.textContent = 'Enter a valid amount greater than 0.';
    inputAmount.classList.add('invalid');
    valid = false;
  }

  if (!inputCategory.value) {
    errCategory.textContent = 'Please select a category.';
    inputCategory.classList.add('invalid');
    valid = false;
  }

  return valid;
}

/* ── Add Transaction ────────────────────────────────────── */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearErrors();

  if (!validateForm()) return;

  const transaction = {
    id:       crypto.randomUUID(),
    name:     inputName.value.trim(),
    amount:   parseFloat(parseFloat(inputAmount.value).toFixed(2)),
    category: inputCategory.value,
    date:     new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };

  transactions.push(transaction);
  saveToStorage();
  renderAll();
  form.reset();
  inputName.focus();
});

/* Clear validation styling on input change */
[inputName, inputAmount, inputCategory].forEach(el => {
  el.addEventListener('input', () => {
    el.classList.remove('invalid');
    const errEl = el === inputName ? errName : el === inputAmount ? errAmount : errCategory;
    errEl.textContent = '';
  });
});

/* ── Delete Transaction ─────────────────────────────────── */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderAll();
}

/* ── Render: Balance ────────────────────────────────────── */
function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalBalanceEl.textContent = formatCurrency(total);
}

/* ── Render: Monthly Summary ────────────────────────────── */
function renderMonthlySummary() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const total = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  monthTotalEl.textContent = formatCurrency(total);
  monthCountEl.textContent = monthTransactions.length;

  // Cari kategori dengan total pengeluaran tertinggi bulan ini
  const catTotals = { Food: 0, Transport: 0, Fun: 0 };
  monthTransactions.forEach(t => {
    if (catTotals[t.category] !== undefined) catTotals[t.category] += t.amount;
  });

  const topCategory = Object.entries(catTotals)
    .filter(([, val]) => val > 0)
    .sort((a, b) => b[1] - a[1])[0];

  monthTopCategoryEl.textContent = topCategory
    ? `${CATEGORY_EMOJI[topCategory[0]]} ${topCategory[0]}`
    : '–';
}

/* ── Sorting ────────────────────────────────────────────── */
function getSortedTransactions() {
  const sorted = [...transactions];

  switch (currentSort) {
    case 'amount-desc':
      return sorted.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return sorted.sort((a, b) => a.amount - b.amount);
    case 'category':
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    case 'date-asc':
      return sorted; // array asli sudah urut lama→baru, jadi tidak perlu reverse
    case 'date-desc':
    default:
      return sorted.reverse(); // newest first (perilaku default lama)
  }
}

sortSelect.addEventListener('change', () => {
  currentSort = sortSelect.value;
  renderTransactions();
});

/* ── Render: Transaction List ───────────────────────────── */
function renderTransactions() {
  // Remove existing items (but keep the empty state element)
  const existingItems = transactionListEl.querySelectorAll('.transaction-item');
  existingItems.forEach(el => el.remove());

  if (transactions.length === 0) {
    emptyState.style.display = 'flex';
    transactionCount.textContent = '0 items';
    return;
  }

  emptyState.style.display = 'none';
  transactionCount.textContent = `${transactions.length} item${transactions.length !== 1 ? 's' : ''}`;

  getSortedTransactions().forEach(t => {
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.dataset.id = t.id;

    item.innerHTML = `
      <span class="item-badge ${t.category.toLowerCase()}" aria-hidden="true"></span>
      <div class="item-info">
        <div class="item-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="item-category">${CATEGORY_EMOJI[t.category]} ${t.category} · ${t.date}</div>
      </div>
      <span class="item-amount">${formatCurrency(t.amount)}</span>
      <button
        class="btn-delete"
        aria-label="Delete ${escapeHtml(t.name)}"
        data-id="${t.id}"
        title="Remove"
      >✕</button>
    `;

    transactionListEl.appendChild(item);
  });
}


/* Event delegation for delete buttons */
transactionListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (btn) deleteTransaction(btn.dataset.id);
});

/* ── Render: Pie Chart ──────────────────────────────────── */
function renderChart() {
  const totals = { Food: 0, Transport: 0, Fun: 0 };

  transactions.forEach(t => {
    if (totals[t.category] !== undefined) totals[t.category] += t.amount;
  });

  const categories = Object.keys(totals).filter(k => totals[k] > 0);
  const data       = categories.map(k => totals[k]);
  const colors     = categories.map(k => CATEGORY_COLORS[k]);

  if (categories.length === 0) {
    chartCanvas.style.display = 'none';
    chartEmptyMsg.style.display = 'block';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartCanvas.style.display = 'block';
  chartEmptyMsg.style.display = 'none';

  if (chartInstance) {
    // Update existing chart data in-place for smooth transition
    chartInstance.data.labels = categories;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    chartInstance = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 13, family: "'Segoe UI', system-ui, sans-serif" },
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val   = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${formatCurrency(val)}  (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

/* ── Master Render ──────────────────────────────────────── */
function renderAll() {
  renderBalance();
  renderMonthlySummary();
  renderTransactions();
  renderChart();
}

/* ── Utility: Format Currency ───────────────────────────── */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

/* ── Utility: Escape HTML ───────────────────────────────── */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ── Init ───────────────────────────────────────────────── */
initTheme();
renderAll();
