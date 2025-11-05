// Sam Removals - Quote Calculator Logic
// Volume calculation engine and UI management

const COMMON_PRESETS = [
    {
        key: 'bedrooms',
        label: 'Bedrooms',
        defaultCount: 2,
        items: {
            BED_QUEEN: 1,
            BEDSIDE_TABLE: 2,
            CHEST_DRAWERS: 1
        }
    },
    {
        key: 'living',
        label: 'Living / Family Rooms',
        defaultCount: 1,
        items: {
            SOFA_3SEAT: 1,
            TABLE_COFFEE: 1,
            TABLE_TV_UNIT: 1
        }
    },
    {
        key: 'study',
        label: 'Study / Office',
        defaultCount: 0,
        items: {
            DESK_LARGE: 1,
            OFFICE_CHAIR: 1,
            BOOKSHELF_SMALL: 1
        }
    }
];

class QuoteCalculator {
    constructor() {
        this.selectedItems = new Map(); // itemCode -> quantity
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.mode = null; // 'inventory' or 'volume'
        this.manualVolume = null;
        this.commonPresetCounts = COMMON_PRESETS.reduce((acc, preset) => {
            acc[preset.key] = preset.defaultCount || 0;
            return acc;
        }, {});

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupModeControls();
        this.setupVolumeControls();
        this.setupPresetModal();
        this.applyModeClasses();
        this.updateSummary();
        this.updateContinueState();
        this.setupProgressNavigation(0);
    }

    setupEventListeners() {
        // Category tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleCategoryChange(e.target.dataset.category);
            });
        });

        // Search box
        const searchBox = document.getElementById('searchBox');
        searchBox.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Continue button
        document.getElementById('continueBtn').addEventListener('click', () => {
            this.handleContinue();
        });

        // mode/preset listeners handled elsewhere
    }

    handleCategoryChange(category) {
        this.currentCategory = category;
        this.searchQuery = '';
        document.getElementById('searchBox').value = '';

        // Update active tab
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        this.renderItems();
    }

    handleSearch(query) {
        this.searchQuery = query.trim();
        this.renderItems();
    }

    renderItems() {
        if (this.mode === 'volume') {
            return;
        }

        const itemsGrid = document.getElementById('itemsGrid');
        let items;

        if (this.searchQuery) {
            items = searchItems(this.searchQuery);
        } else {
            items = getItemsByCategory(this.currentCategory);
        }

        if (items.length === 0) {
            itemsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon">🔍</div>
                    <p>No items found matching "${this.searchQuery}"</p>
                </div>
            `;
            return;
        }

        itemsGrid.innerHTML = items.map(item => this.createItemCard(item)).join('');

        // Add event listeners to all item cards
        items.forEach(item => {
            this.attachItemCardListeners(item);
        });
    }

    createItemCard(item) {
        const quantity = this.selectedItems.get(item.itemCode) || 0;
        const isSelected = quantity > 0;

        return `
            <div class="item-card ${isSelected ? 'selected' : ''}" data-item-code="${item.itemCode}">
                <div class="item-header">
                    <div class="item-name">${item.name}</div>
                    ${item.isSpecialty ? '<span class="item-badge">Specialty</span>' : ''}
                </div>
                <div class="item-details">
                    ${item.description}<br>
                    <span class="item-volume">${item.volumeM3} m³</span>
                    ${item.surcharge > 0 ? ` • +$${item.surcharge} surcharge` : ''}
                </div>
                <div class="item-controls">
                    ${isSelected ? `
                        <div class="quantity-control">
                            <button class="qty-button qty-minus" data-item-code="${item.itemCode}">−</button>
                            <span class="qty-display">${quantity}</span>
                            <button class="qty-button qty-plus" data-item-code="${item.itemCode}">+</button>
                        </div>
                    ` : `
                        <button class="add-item-btn" data-item-code="${item.itemCode}">
                            + Add Item
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    attachItemCardListeners(item) {
        const card = document.querySelector(`[data-item-code="${item.itemCode}"]`);
        if (!card) return;

        // Add button
        const addBtn = card.querySelector('.add-item-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addItem(item.itemCode);
            });
        }

        // Plus button
        const plusBtn = card.querySelector('.qty-plus');
        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                this.incrementItem(item.itemCode);
            });
        }

        // Minus button
        const minusBtn = card.querySelector('.qty-minus');
        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                this.decrementItem(item.itemCode);
            });
        }
    }

    addItem(itemCode) {
        this.selectedItems.set(itemCode, 1);
        this.renderItems();
        this.updateSummary();
    }

    incrementItem(itemCode) {
        const current = this.selectedItems.get(itemCode) || 0;
        this.selectedItems.set(itemCode, current + 1);
        this.renderItems();
        this.updateSummary();
    }

    decrementItem(itemCode) {
        const current = this.selectedItems.get(itemCode) || 0;
        if (current > 1) {
            this.selectedItems.set(itemCode, current - 1);
        } else {
            this.selectedItems.delete(itemCode);
        }
        this.renderItems();
        this.updateSummary();
    }

    removeItem(itemCode) {
        this.selectedItems.delete(itemCode);
        this.renderItems();
        this.updateSummary();
    }

    setupModeControls() {
        const inventoryCard = document.getElementById('choiceInventory');
        const volumeCard = document.getElementById('choiceVolume');
        const backLink = document.getElementById('backToInventory');

        if (inventoryCard) {
            inventoryCard.addEventListener('click', () => this.switchMode('inventory'));
        }

        if (volumeCard) {
            volumeCard.addEventListener('click', () => this.switchMode('volume'));
        }

        if (backLink) {
            backLink.addEventListener('click', () => this.switchMode('inventory'));
        }
    }

    applyModeClasses() {
        document.body.classList.toggle('inventory-mode', this.mode === 'inventory');
        document.body.classList.toggle('volume-mode', this.mode === 'volume');
        document.body.classList.toggle('mode-unset', !this.mode);

        if (this.openPresetButton) {
            this.openPresetButton.disabled = this.mode !== 'inventory';
        }
    }

    scrollToSection(sectionId, focusTargetId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (!focusTargetId) return;
        const focusEl = document.getElementById(focusTargetId);
        if (!focusEl) return;

        const originalTabIndex = focusEl.getAttribute('tabindex');
        if (originalTabIndex === null) {
            focusEl.setAttribute('tabindex', '-1');
        }

        setTimeout(() => {
            focusEl.focus({ preventScroll: true });
        }, 400);
    }

    setupVolumeControls() {
        const numberInput = document.getElementById('volumeNumber');
        const rangeInput = document.getElementById('volumeRange');

        if (numberInput) {
            numberInput.addEventListener('input', (e) => {
                this.handleVolumeInput(e.target.value, 'number');
            });
        }

        if (rangeInput) {
            rangeInput.addEventListener('input', (e) => {
                this.handleVolumeInput(e.target.value, 'range');
            });
        }
    }

    setupPresetModal() {
        this.presetModal = document.getElementById('presetModal');
        this.openPresetButton = document.getElementById('openPresetModal');

        if (!this.presetModal || !this.openPresetButton) return;

        const cancelBtn = document.getElementById('presetCancel');
        const applyBtn = document.getElementById('presetApply');

        this.openPresetButton.addEventListener('click', () => this.openPresetModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closePresetModal());
        if (applyBtn) applyBtn.addEventListener('click', () => this.applyCommonPresets());

        this.presetModal.addEventListener('click', (event) => {
            if (event.target === this.presetModal) {
                this.closePresetModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.presetModal.classList.contains('open')) {
                this.closePresetModal();
            }
        });

        COMMON_PRESETS.forEach((preset) => {
            const row = document.querySelector(`[data-preset=\"${preset.key}\"]`);
            if (!row) return;
            const minus = row.querySelector('.preset-minus');
            const plus = row.querySelector('.preset-plus');
            if (minus) {
                minus.addEventListener('click', () => this.adjustPresetCount(preset.key, -1));
            }
            if (plus) {
                plus.addEventListener('click', () => this.adjustPresetCount(preset.key, 1));
            }
        });

        this.refreshPresetCounts();
    }

    openPresetModal() {
        this.refreshPresetCounts();
        this.presetModal.classList.add('open');
        this.presetModal.setAttribute('aria-hidden', 'false');
    }

    closePresetModal() {
        this.presetModal.classList.remove('open');
        this.presetModal.setAttribute('aria-hidden', 'true');
        if (this.openPresetButton) {
            this.openPresetButton.focus();
        }
    }

    adjustPresetCount(key, delta) {
        const next = Math.max(0, (this.commonPresetCounts[key] || 0) + delta);
        this.commonPresetCounts[key] = next;
        this.refreshPresetCounts();
    }

    refreshPresetCounts() {
        COMMON_PRESETS.forEach((preset) => {
            const countEl = document.querySelector(`[data-preset-count=\"${preset.key}\"]`);
            if (countEl) {
                countEl.textContent = this.commonPresetCounts[preset.key] ?? 0;
            }
        });
    }

    applyCommonPresets() {
        if (this.mode !== 'inventory') {
            this.switchMode('inventory');
        }

        let itemsAdded = false;

        COMMON_PRESETS.forEach((preset) => {
            const count = this.commonPresetCounts[preset.key] || 0;
            if (count > 0) {
                this.applyPresetItems(preset, count);
                itemsAdded = true;
            }
        });

        if (itemsAdded) {
            this.renderItems();
            this.updateSummary();
            this.updateContinueState();
        }

        COMMON_PRESETS.forEach((preset) => {
            this.commonPresetCounts[preset.key] = preset.defaultCount || 0;
        });
        this.refreshPresetCounts();
        this.closePresetModal();
    }

    applyPresetItems(preset, count) {
        Object.entries(preset.items).forEach(([itemCode, qty]) => {
            const current = this.selectedItems.get(itemCode) || 0;
            this.selectedItems.set(itemCode, current + qty * count);
        });
    }

    setupProgressNavigation(currentIndex) {
        const steps = Array.from(document.querySelectorAll('.progress-step'));
        steps.forEach((step, index) => {
            const target = step.dataset.target;
            if (!target) return;

            step.classList.remove('clickable');
            step.removeAttribute('role');
            step.removeAttribute('tabindex');
            step.setAttribute('aria-disabled', 'true');

            if (index < currentIndex) {
                const navigate = () => {
                    window.location.href = target;
                };

                step.classList.add('clickable');
                step.setAttribute('role', 'link');
                step.setAttribute('tabindex', '0');
                 step.setAttribute('aria-disabled', 'false');
                step.addEventListener('click', navigate);
                step.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate();
                    }
                });
            }
        });
    }

    switchMode(mode) {
        if (this.mode === mode) return;

        this.mode = mode;
        this.applyModeClasses();

        const inventoryCard = document.getElementById('choiceInventory');
        const volumeCard = document.getElementById('choiceVolume');

        if (inventoryCard) {
            inventoryCard.classList.toggle('active', mode === 'inventory');
            inventoryCard.setAttribute('aria-pressed', mode === 'inventory' ? 'true' : 'false');
        }

        if (volumeCard) {
            volumeCard.classList.toggle('active', mode === 'volume');
            volumeCard.setAttribute('aria-pressed', mode === 'volume' ? 'true' : 'false');
        }

        if (mode === 'volume') {
            if (this.manualVolume === null) {
                const defaultVolume = parseFloat(document.getElementById('volumeRange')?.value || '20');
                this.manualVolume = defaultVolume;
            }
            this.syncVolumeInputs(this.manualVolume, 'init');
            this.scrollToSection('volumePanel', 'volumeHeading');
        } else if (mode === 'inventory') {
            const currentCategory = this.currentCategory || 'all';
            const tabs = document.querySelectorAll('.tab-button');
            tabs.forEach(tab => tab.classList.remove('active'));
            const activeTab = document.querySelector(`.tab-button[data-category="${currentCategory}"]`);
            if (activeTab) activeTab.classList.add('active');
            this.renderItems();
            this.scrollToSection('inventoryPanel', 'inventoryHeading');
        }

        this.updateSummary();
        this.updateContinueState();
    }

    handleVolumeInput(rawValue, source) {
        if (rawValue === '') {
            this.manualVolume = null;
            this.syncVolumeInputs(null, source);
            this.updateSummary();
            this.updateContinueState();
            return;
        }

        let volume = parseFloat(rawValue);
        if (Number.isNaN(volume)) {
            return;
        }

        volume = Math.min(80, Math.max(1, volume));
        this.manualVolume = volume;
        this.syncVolumeInputs(volume, source);
        this.updateSummary();
        this.updateContinueState();
    }

    syncVolumeInputs(volume, source) {
        const numberInput = document.getElementById('volumeNumber');
        const rangeInput = document.getElementById('volumeRange');
        const reserve = document.getElementById('volumeReserve');
        const volumeMeta = document.getElementById('choiceVolumeMeta');

        if (volume === null || Number.isNaN(volume)) {
            if (numberInput) numberInput.value = '';
            if (rangeInput) rangeInput.value = rangeInput.min;
            if (reserve) reserve.textContent = '—';
            if (volumeMeta) volumeMeta.textContent = 'Set volume';
            return;
        }

        const formatted = Number.parseFloat(volume.toFixed(1));

        if (numberInput) {
            numberInput.value = formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1);
        }
        if (rangeInput) {
            rangeInput.value = formatted;
        }
        if (reserve) reserve.textContent = `${formatted.toFixed(1)} m³`;
        if (volumeMeta) volumeMeta.textContent = `${formatted.toFixed(1)} m³`;
    }

    updateContinueState() {
        const continueBtn = document.getElementById('continueBtn');
        if (!continueBtn) return;

        if (this.mode === 'inventory') {
            continueBtn.disabled = this.calculateTotalItems() === 0;
        } else if (this.mode === 'volume') {
            continueBtn.disabled = !(this.manualVolume && this.manualVolume > 0);
        } else {
            continueBtn.disabled = true;
        }
    }

    // CORE CALCULATION METHODS

    calculateTotalVolume() {
        let totalVolume = 0;

        this.selectedItems.forEach((quantity, itemCode) => {
            const item = INVENTORY_CATALOG.find(i => i.itemCode === itemCode);
            if (item) {
                totalVolume += item.volumeM3 * quantity;
            }
        });

        return totalVolume;
    }

    calculateTotalItems() {
        let total = 0;
        this.selectedItems.forEach(quantity => {
            total += quantity;
        });
        return total;
    }

    calculateLoadingTime() {
        // Industry standard: 1 hour per 10 m³
        const volume = this.calculateTotalVolume();
        const baseTime = volume / 10;

        // Apply time multipliers for specialty items
        let timeMultiplier = 1.0;
        let totalWeightedVolume = 0;
        let totalVolume = 0;

        this.selectedItems.forEach((quantity, itemCode) => {
            const item = INVENTORY_CATALOG.find(i => i.itemCode === itemCode);
            if (item) {
                const itemVolume = item.volumeM3 * quantity;
                totalVolume += itemVolume;
                totalWeightedVolume += itemVolume * item.timeMultiplier;
            }
        });

        if (totalVolume > 0) {
            timeMultiplier = totalWeightedVolume / totalVolume;
        }

        const adjustedTime = baseTime * timeMultiplier;

        // Return both loading and unloading time (same duration)
        return {
            loadingHours: adjustedTime,
            unloadingHours: adjustedTime,
            totalHandlingHours: adjustedTime * 2
        };
    }

    calculateRecommendedCrewSize(volumeOverride = null) {
        const volume = volumeOverride ?? this.calculateTotalVolume();

        // Crew size logic based on volume
        // 1-bedroom (< 15 m³): 2 movers
        // 2-3 bedroom (15-35 m³): 3 movers
        // 4+ bedroom (> 35 m³): 4 movers

        if (!volume || volume === 0) return 2;
        if (volume < 15) return 2;
        if (volume < 35) return 3;
        return 4;
    }

    calculateTotalSurcharges() {
        let totalSurcharge = 0;

        this.selectedItems.forEach((quantity, itemCode) => {
            const item = INVENTORY_CATALOG.find(i => i.itemCode === itemCode);
            if (item && item.surcharge > 0) {
                totalSurcharge += item.surcharge * quantity;
            }
        });

        return totalSurcharge;
    }

    getSelectedItemsDetails() {
        const items = [];

        this.selectedItems.forEach((quantity, itemCode) => {
            const item = INVENTORY_CATALOG.find(i => i.itemCode === itemCode);
            if (item) {
                items.push({
                    ...item,
                    quantity,
                    totalVolume: item.volumeM3 * quantity,
                    totalSurcharge: item.surcharge * quantity
                });
            }
        });

        return items.sort((a, b) => b.totalVolume - a.totalVolume);
    }

    calculateHandlingTimeFromVolume(volume) {
        const safeVolume = Math.max(0, volume || 0);
        const baseTime = safeVolume / 10;
        return {
            loadingHours: baseTime,
            unloadingHours: baseTime,
            totalHandlingHours: baseTime * 2
        };
    }

    updateSummary() {
        let totalItems = '—';
        let totalVolume = 0;
        let timeEstimate = { loadingHours: 0, unloadingHours: 0, totalHandlingHours: 0 };
        let crewSize = null;

        const hasManualVolume = typeof this.manualVolume === 'number' && this.manualVolume > 0;

        if (this.mode === 'inventory') {
            totalItems = this.calculateTotalItems();
            totalVolume = this.calculateTotalVolume();
            timeEstimate = this.calculateLoadingTime();
            crewSize = this.calculateRecommendedCrewSize(totalVolume);
        } else if (this.mode === 'volume') {
            totalItems = '—';
            totalVolume = hasManualVolume ? this.manualVolume : 0;
            timeEstimate = this.calculateHandlingTimeFromVolume(totalVolume);
            crewSize = this.calculateRecommendedCrewSize(totalVolume);
        }

        const volumeDisplay = (!this.mode || (this.mode === 'volume' && !hasManualVolume))
            ? '—'
            : `${totalVolume.toFixed(2)} m³`;
        const timeDisplay = (!this.mode || (this.mode === 'volume' && !hasManualVolume))
            ? '—'
            : `${timeEstimate.totalHandlingHours.toFixed(1)} hrs`;
        const crewDisplay = (!this.mode || (this.mode === 'volume' && !hasManualVolume))
            ? '—'
            : `${crewSize} mover${crewSize > 1 ? 's' : ''}`;

        // Update summary stats
        document.getElementById('totalItems').textContent =
            this.mode === 'inventory' ? totalItems : '—';
        document.getElementById('totalVolume').textContent = volumeDisplay;
        document.getElementById('estTime').textContent = timeDisplay;
        document.getElementById('crewSize').textContent = crewDisplay;

        // Update hero meta and footer vitals if present
        const choiceMeta = document.getElementById('choiceItemsMeta');
        if (choiceMeta) {
            if (this.mode === 'inventory') {
                const suffix = totalItems === 1 ? 'item selected' : 'items selected';
                choiceMeta.textContent = `${totalItems} ${suffix}`;
            } else if (this.mode === 'volume') {
                choiceMeta.textContent = 'Switch to inventory →';
            } else {
                choiceMeta.textContent = 'Choose a method to get started';
            }
        }

        const footerItems = document.getElementById('footerItems');
        if (footerItems) {
            if (this.mode === 'inventory') {
                const suffix = totalItems === 1 ? 'item' : 'items';
                footerItems.textContent = `${totalItems} ${suffix}`;
            } else if (this.mode === 'volume') {
                footerItems.textContent = 'Volume entry';
            } else {
                footerItems.textContent = '—';
            }
        }

        const footerVolume = document.getElementById('footerVolume');
        if (footerVolume) {
            footerVolume.textContent = volumeDisplay;
        }

        const footerCrew = document.getElementById('footerCrew');
        if (footerCrew) {
            footerCrew.textContent = crewDisplay;
        }

        const volumeMeta = document.getElementById('choiceVolumeMeta');
        if (volumeMeta) {
            if (this.mode === 'volume') {
                volumeMeta.textContent = hasManualVolume ? `${totalVolume.toFixed(1)} m³` : 'Set volume';
            } else {
                volumeMeta.textContent = this.manualVolume ? `${this.manualVolume.toFixed(1)} m³` : 'Enter volume';
            }
        }

        // Update selected items list
        this.updateSelectedItemsList();

        // Store quote data for next steps
        this.storeQuoteData();
        this.updateContinueState();
    }

    updateSelectedItemsList() {
        const listContainer = document.getElementById('selectedItemsList');
        if (!this.mode) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🧭</div>
                    <p>Select a starting method to build your quote.</p>
                </div>
            `;
            return;
        }

        if (this.mode === 'volume') {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📏</div>
                    <p>Volume-based quote active. No inventory list required.</p>
                </div>
            `;
            return;
        }

        const items = this.getSelectedItemsDetails();

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <p>No items selected yet</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = items.map(item => `
            <div class="selected-item">
                <div class="selected-item-name">${item.name}</div>
                <div class="selected-item-qty">×${item.quantity}</div>
                <button class="remove-btn" data-item-code="${item.itemCode}">Remove</button>
            </div>
        `).join('');

        // Add remove button listeners
        listContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeItem(e.target.dataset.itemCode);
            });
        });
    }

    storeQuoteData() {
        if (!this.mode) return;
        if (this.mode === 'volume' && (!this.manualVolume || this.manualVolume <= 0)) {
            return;
        }

        // Store current quote data in localStorage for next steps
        let quoteData;

        if (this.mode === 'inventory') {
            quoteData = {
                estimationMethod: 'inventory',
                selectedItems: Array.from(this.selectedItems.entries()),
                itemsDetails: this.getSelectedItemsDetails(),
                totalVolume: this.calculateTotalVolume(),
                totalItems: this.calculateTotalItems(),
                loadingTime: this.calculateLoadingTime(),
                crewSize: this.calculateRecommendedCrewSize(),
                specialtySurcharges: this.calculateTotalSurcharges(),
                timestamp: new Date().toISOString()
            };
        } else {
            const volume = this.manualVolume || 0;
            quoteData = {
                estimationMethod: 'volume',
                selectedItems: [],
                itemsDetails: [],
                totalVolume: volume,
                totalItems: 0,
                loadingTime: this.calculateHandlingTimeFromVolume(volume),
                crewSize: this.calculateRecommendedCrewSize(volume),
                specialtySurcharges: 0,
                volumeEntry: {
                    manualVolume: volume,
                    source: 'customer-direct'
                },
                timestamp: new Date().toISOString()
            };
        }

        localStorage.setItem('samRemovals_quoteData', JSON.stringify(quoteData));
    }

    handleContinue() {
        // Navigate to the locations page
        window.location.href = 'quote-locations.html';
    }

    // UTILITY METHODS

    exportQuoteData() {
        if (this.mode === 'volume') {
            const volume = this.manualVolume || 0;
            const time = this.calculateHandlingTimeFromVolume(volume);
            return {
                estimationMethod: 'volume',
                items: [],
                summary: {
                    totalItems: 0,
                    totalVolumeM3: volume,
                    loadingHours: time.loadingHours,
                    unloadingHours: time.unloadingHours,
                    totalHandlingHours: time.totalHandlingHours,
                    recommendedCrewSize: this.calculateRecommendedCrewSize(volume),
                    specialtySurcharges: 0
                }
            };
        }

        const time = this.calculateLoadingTime();
        return {
            estimationMethod: 'inventory',
            items: this.getSelectedItemsDetails(),
            summary: {
                totalItems: this.calculateTotalItems(),
                totalVolumeM3: this.calculateTotalVolume(),
                loadingHours: time.loadingHours,
                unloadingHours: time.unloadingHours,
                totalHandlingHours: time.totalHandlingHours,
                recommendedCrewSize: this.calculateRecommendedCrewSize(),
                specialtySurcharges: this.calculateTotalSurcharges()
            }
        };
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new QuoteCalculator();

    // Expose for debugging
    window.exportQuoteData = () => {
        console.log(JSON.stringify(window.calculator.exportQuoteData(), null, 2));
    };
});
