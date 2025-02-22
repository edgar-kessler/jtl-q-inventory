const db = require('./services/database');

// DOM Elements
const yearFilter = document.getElementById('yearFilter');
const quarterFilter = document.getElementById('quarterFilter');
const brandFilter = document.getElementById('brandFilter');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const hideEmptyStockCheckbox = document.getElementById('hideEmptyStock');
const productsGrid = document.getElementById('productsGrid');
const productTemplate = document.getElementById('productTemplate');
const loadingIndicator = document.getElementById('loadingIndicator');
const startSearchButton = document.getElementById('startSearch');
const cancelSearchButton = document.getElementById('cancelSearch');

let currentSearchController = null;

// Format currency
function formatCurrency(value) {
    if (typeof value !== 'number') {
        console.warn('Invalid currency value:', value);
        return '0.00 €';
    }
    return value.toFixed(2) + ' €';
}

// Format percentage
function formatPercentage(value) {
    if (typeof value !== 'number') {
        console.warn('Invalid percentage value:', value);
        return '0.00%';
    }
    return value.toFixed(2) + '%';
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (err) {
        console.warn('Invalid date:', dateStr);
        return '-';
    }
}

// Show loading state
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    cancelSearchButton.classList.remove('hidden');
    startSearchButton.disabled = true;
    startSearchButton.classList.add('opacity-50');
}

// Hide loading state
function hideLoading() {
    loadingIndicator.classList.add('hidden');
    cancelSearchButton.classList.add('hidden');
    startSearchButton.disabled = false;
    startSearchButton.classList.remove('opacity-50');
}

// Cancel current search
function cancelSearch() {
    if (currentSearchController) {
        currentSearchController.abort();
        currentSearchController = null;
    }
    hideLoading();
}

// Update products based on filters
async function updateProducts() {
    try {
        // Cancel any ongoing search
        cancelSearch();

        // Create new abort controller
        currentSearchController = new AbortController();
        showLoading();

        const selectedYear = yearFilter.value;
        const selectedQuarter = quarterFilter.value;
        const selectedBrand = brandFilter.value;
        const selectedCategory = categoryFilter.value;
        const hideEmptyStock = hideEmptyStockCheckbox.checked;

        // Clear current products
        productsGrid.innerHTML = '';

        // Fetch and display products
        const products = await db.getParentProducts(
            selectedQuarter,
            selectedYear,
            selectedBrand === 'all' ? null : selectedBrand,
            selectedCategory === 'all' ? null : selectedCategory
        );

        // Sort products
        const sortedProducts = sortProducts(products);

        // Filter out products with no stock if checkbox is checked
        const filteredProducts = hideEmptyStock
            ? sortedProducts.filter(p => (parseInt(p.Lagerbestand) || 0) > 0)
            : sortedProducts;

        // Display products
        await displayProducts(filteredProducts);

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Search aborted');
        } else {
            console.error('Error updating products:', err);
            alert('Fehler beim Aktualisieren der Produkte: ' + err.message);
        }
    } finally {
        hideLoading();
    }
}

// Sort products based on selected sort option
function sortProducts(products) {
    const sortOption = sortFilter.value;
    return [...products].sort((a, b) => {
        switch (sortOption) {
            case 'date_desc':
                return new Date(b.dErstellt) - new Date(a.dErstellt);
            case 'date_asc':
                return new Date(a.dErstellt) - new Date(b.dErstellt);
            case 'stock_desc':
                return (parseInt(b.Lagerbestand) || 0) - (parseInt(a.Lagerbestand) || 0);
            case 'stock_asc':
                return (parseInt(a.Lagerbestand) || 0) - (parseInt(b.Lagerbestand) || 0);
            case 'sales_desc':
                return (parseInt(b.sales) || 0) - (parseInt(a.sales) || 0);
            case 'sales_asc':
                return (parseInt(a.sales) || 0) - (parseInt(b.sales) || 0);
            case 'price_desc':
                return (parseFloat(b.Preis) || 0) - (parseFloat(a.Preis) || 0);
            case 'price_asc':
                return (parseFloat(a.Preis) || 0) - (parseFloat(b.Preis) || 0);
            default:
                return 0;
        }
    });
}

// Display child products
async function displayChildProducts(parentId, container, loadingElement) {
    try {
        loadingElement.classList.remove('hidden');
        const children = await db.getChildProducts(parentId);
        
        container.innerHTML = '';
        children.forEach(child => {
            const childNetPrice = parseFloat(child.Preis) || 0;
            const childPurchasePrice = parseFloat(child.fEKNetto) || 0;
            const childProfit = childNetPrice - childPurchasePrice;
            const childMarginPercent = childPurchasePrice > 0 ? (childProfit / childPurchasePrice) * 100 : 0;

            const childDiv = document.createElement('div');
            childDiv.className = 'py-4 px-6 hover:bg-gray-50';
            childDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium text-gray-900">${child.cName}</div>
                        <div class="text-sm text-gray-500">Art.-Nr.: ${child.cArtNr}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-medium text-gray-900">Bestand: ${child.Lagerbestand || 0}</div>
                        <div class="text-sm text-gray-500">Netto: ${formatCurrency(childNetPrice)}</div>
                        <div class="text-sm text-gray-500">EK: ${formatCurrency(childPurchasePrice)}</div>
                        <div class="text-sm text-gray-500">Gewinn: ${formatCurrency(childProfit)}</div>
                        <div class="text-sm text-gray-500">Marge: ${formatPercentage(childMarginPercent)}</div>
                    </div>
                </div>
            `;
            container.appendChild(childDiv);
        });
    } catch (err) {
        console.error('Error loading child products:', err);
        container.innerHTML = '<div class="p-4 text-red-500">Fehler beim Laden der Varianten</div>';
    } finally {
        loadingElement.classList.add('hidden');
    }
}

// Display products in the list
async function displayProducts(products) {
    try {
        productsGrid.innerHTML = '';
        
        for (const product of products) {
            const productItem = productTemplate.content.cloneNode(true);
            
            // Set product details
            productItem.querySelector('.product-name').textContent = product.cName;
            productItem.querySelector('.product-number').textContent = `Art.-Nr.: ${product.cArtNr}`;
            
            // Set image
            const productImage = productItem.querySelector('.product-image');
            if (product.Produktbild) {
                const base64Image = arrayBufferToBase64(product.Produktbild);
                productImage.src = `data:image/png;base64,${base64Image}`;
            } else {
                productImage.src = 'placeholder.png';
            }

            // Parse numeric values
            const netPrice = parseFloat(product.Preis) || 0;
            const purchasePrice = parseFloat(product.fEKNetto) || 0;
            const profit = netPrice - purchasePrice;
            const marginPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

            // Set dates and prices
            productItem.querySelector('.release-date').textContent = formatDate(product.dErstellt);
            productItem.querySelector('.price-uvp').textContent = formatCurrency(parseFloat(product.fUVP));
            productItem.querySelector('.price-gross').textContent = formatCurrency(netPrice * 1.19);
            productItem.querySelector('.price-net').textContent = formatCurrency(netPrice);
            productItem.querySelector('.price-purchase').textContent = formatCurrency(purchasePrice);
            productItem.querySelector('.profit').textContent = formatCurrency(profit);
            productItem.querySelector('.margin-percent').textContent = formatPercentage(marginPercent);
            
            // Set stock and sales
            const totalStock = parseInt(product.Lagerbestand) || 0;
            productItem.querySelector('.stock-total').textContent = totalStock;
            
            // Set discount
            if (product.Rabatt > 0) {
                productItem.querySelector('.discount-badge').textContent = `-${product.Rabatt}%`;
            }

            // Add child products
            const childProductsContainer = productItem.querySelector('.child-products');
            const childProductsLoading = productItem.querySelector('.child-products-loading');
            const toggleButton = productItem.querySelector('.toggle-children');
            
            // Load child products when toggle button is clicked
            toggleButton.onclick = async () => {
                toggleButton.classList.toggle('active');
                childProductsContainer.classList.toggle('hidden');
                const icon = toggleButton.querySelector('i');
                icon.style.transform = childProductsContainer.classList.contains('hidden') ? '' : 'rotate(180deg)';
                
                if (childProductsContainer.children.length === 0) {
                    await displayChildProducts(product.kArtikel, childProductsContainer, childProductsLoading);
                }
            };

            // Load and display total sales (last 3 months)
            try {
                const salesData = await db.getSalesData(product.kArtikel);
                let totalSales = 0;
                salesData.forEach(row => {
                    totalSales += parseInt(row.Gesamt) || 0;
                });
                productItem.querySelector('.sales-total').textContent = totalSales;
            } catch (err) {
                console.error('Error loading sales data:', err);
                productItem.querySelector('.sales-total').textContent = '-';
            }

            productsGrid.appendChild(productItem);
        }
    } catch (err) {
        console.error('Error displaying products:', err);
        alert('Fehler beim Anzeigen der Produkte: ' + err.message);
    }
}

// Convert array buffer to base64
function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Initialize manufacturers dropdown
async function initializeManufacturers() {
    try {
        const manufacturers = await db.getManufacturers();
        manufacturers.forEach(manufacturer => {
            const option = document.createElement('option');
            option.value = manufacturer.kHersteller;
            option.textContent = manufacturer.cName;
            brandFilter.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading manufacturers:', err);
    }
}

// Initialize product categories dropdown
async function initializeCategories() {
    try {
        const categories = await db.getProductCategories();
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.kWarengruppe;
            option.textContent = category.cName;
            categoryFilter.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

// Event Listeners
startSearchButton.addEventListener('click', updateProducts);
cancelSearchButton.addEventListener('click', cancelSearch);

// Initialize dropdowns
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        initializeManufacturers(),
        initializeCategories()
    ]);
    await updateProducts();
});
