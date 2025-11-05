// Sam Removals - Final Quote Calculator
// Complete pricing engine with hourly and flat-rate models

class FinalQuoteCalculator {
    constructor() {
        this.quoteData = this.loadQuoteData();

        // Pricing configuration (from specification)
        this.HOURLY_RATES = {
            2: 190,  // 2 movers: $180-200, using $190 average
            3: 280,  // 3 movers: $260-300, using $280 average
            4: 375   // 4 movers: $350-400, using $375 average
        };

        this.WEEKEND_PREMIUM = 0.15; // 15% for weekends/holidays
        this.FLAT_RATE_PREMIUM = 0.12; // 12% risk premium for flat rate
        this.BACKLOAD_DISCOUNT_RATE = 0.5; // Up to 50% off labour & travel when flexible

        this.currentPricingModel = 'hourly'; // 'hourly' or 'flat'

        // Email delivery configuration (set window.SAM_REMOVALS_EMAIL_ENDPOINT / EMAIL_API_KEY in production)
        this.EMAIL_ENDPOINT = window.SAM_REMOVALS_EMAIL_ENDPOINT || null;
        this.EMAIL_API_KEY = window.SAM_REMOVALS_EMAIL_API_KEY || null;

        this.init();
    }

    init() {
        if (!this.quoteData) return;

        this.generateQuoteReference();
        this.displayMoveDetails();
        this.calculateAndDisplayQuote();
        this.displayInventory();
        this.initializeContactState();
        this.setupProgressNavigation(4);
    }

    loadQuoteData() {
        const data = localStorage.getItem('samRemovals_quoteData');
        if (!data) {
            alert('No quote data found. Redirecting to start...');
            window.location.href = 'quote-calculator.html';
            return null;
        }
        const parsed = JSON.parse(data);
        if (!parsed.customerName && parsed.customer && parsed.customer.name) {
            parsed.customerName = parsed.customer.name;
        }
        return parsed;
    }

    generateQuoteReference() {
        // Generate unique quote reference
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        const ref = `SRM-${year}${month}${day}-${random}`;
        document.getElementById('quoteRef').textContent = `Quote Reference: ${ref}`;

        this.quoteReference = ref;
    }

    displayMoveDetails() {
        const nameDisplay = document.getElementById('customerNameDisplay');
        if (nameDisplay) {
            const name = this.quoteData.customer?.name ||
                this.quoteData.customerName ||
                'Add contact details';
            nameDisplay.textContent = name;
        }

        const moveDateEl = document.getElementById('moveDate');
        if (moveDateEl) {
            if (this.quoteData.moveDate) {
                const moveDate = new Date(this.quoteData.moveDate);
                if (!Number.isNaN(moveDate.getTime())) {
                    const dateStr = moveDate.toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    moveDateEl.textContent = dateStr;
                } else {
                    moveDateEl.textContent = this.quoteData.moveDate;
                }
            } else {
                moveDateEl.textContent = 'Schedule to be confirmed';
            }
        }

        const routeSummary = document.getElementById('routeSummary');
        if (routeSummary && this.quoteData.origin && this.quoteData.destination) {
            routeSummary.textContent =
                `${this.quoteData.origin.suburb} → ${this.quoteData.destination.suburb}`;
        }

        const distanceEl = document.getElementById('distance');
        if (distanceEl && this.quoteData.route) {
            distanceEl.textContent = `${this.quoteData.route.distanceKm} km`;
        }

        const volumeEl = document.getElementById('totalVolume');
        if (volumeEl) {
            volumeEl.textContent = `${this.quoteData.totalVolume.toFixed(2)} m³`;
        }

        const crewEl = document.getElementById('crewSize');
        if (crewEl) {
            crewEl.textContent =
                `${this.quoteData.crewSize} mover${this.quoteData.crewSize > 1 ? 's' : ''}`;
        }

        const flexibilityEl = document.getElementById('scheduleFlexibility');
        if (flexibilityEl) {
            flexibilityEl.textContent = this.quoteData.flexibleSchedule
                ? 'Flexible (backloading)'
                : 'Fixed schedule';
        }

        const accessNotesEl = document.getElementById('accessNotesDisplay');
        if (accessNotesEl) {
            const notes = (this.quoteData.frictionNotes || this.quoteData.accessNotes || '').trim();
            accessNotesEl.textContent = notes || 'None provided';
        }
    }

    calculateHourlyCosts() {
        const crewSize = this.quoteData.crewSize;
        const hourlyRate = this.HOURLY_RATES[crewSize] || this.HOURLY_RATES[4];

        // Total estimated hours (including friction adjustments)
        const totalHours = this.quoteData.frictionCalculations.totalEstimatedHours;
        const handlingHours = this.quoteData.frictionCalculations.adjustedHandlingHours;
        const travelHours = this.quoteData.route.durationMinutes / 60;

        // Labor cost (handling only, travel billed separately for transparency)
        const laborCost = handlingHours * hourlyRate;

        // Travel cost
        const travelCost = travelHours * hourlyRate;

        // Surcharges
        const frictionSurcharges = this.quoteData.surcharges.totalFriction;
        const specialtySurcharges = this.quoteData.surcharges.specialtyItems || 0;
        const totalSurcharges = frictionSurcharges + specialtySurcharges;

        // Tolls
        const tollsCost = this.quoteData.route.estimatedTollCost;

        const subtotalBeforeDiscount = laborCost + travelCost + totalSurcharges + tollsCost;

        // Flexible scheduling discount (applies to labour + travel only)
        let backloadDiscount = 0;
        if (this.quoteData.flexibleSchedule) {
            backloadDiscount = (laborCost + travelCost) * this.BACKLOAD_DISCOUNT_RATE;
        }

        const discountedSubtotal = Math.max(0, subtotalBeforeDiscount - backloadDiscount);

        // Weekend premium (if applicable)
        let weekendPremium = 0;
        if (this.quoteData.isWeekend) {
            weekendPremium = discountedSubtotal * this.WEEKEND_PREMIUM;
        }

        // Total
        const total = discountedSubtotal + weekendPremium;

        return {
            hourlyRate,
            totalHours,
            handlingHours,
            travelHours,
            laborCost,
            travelCost,
            totalSurcharges,
            tollsCost,
            subtotalBeforeDiscount,
            backloadDiscount,
            subtotal: discountedSubtotal,
            weekendPremium,
            total
        };
    }

    calculateFlatRateCosts() {
        // Start with hourly calculation
        const hourlyCalc = this.calculateHourlyCosts();

        // Add risk premium for price certainty
        const riskPremium = hourlyCalc.total * this.FLAT_RATE_PREMIUM;
        const flatTotal = hourlyCalc.total + riskPremium;

        return {
            ...hourlyCalc,
            riskPremium,
            total: flatTotal
        };
    }

    calculateAndDisplayQuote() {
        let costs;

        if (this.currentPricingModel === 'hourly') {
            costs = this.calculateHourlyCosts();
            this.displayHourlyQuote(costs);
        } else {
            costs = this.calculateFlatRateCosts();
            this.displayFlatRateQuote(costs);
        }

        // Display time breakdown
        this.displayTimeBreakdown();
        this.updateFooter(costs);
        this.updateEstimateMessaging(costs);

        // Show weekend item if applicable
        if (this.quoteData.isWeekend) {
            document.getElementById('weekendItem').style.display = 'flex';
            document.getElementById('weekendCost').textContent = `$${costs.weekendPremium.toFixed(2)}`;
        } else {
            document.getElementById('weekendItem').style.display = 'none';
        }
    }

    updateFooter(costs) {
        const amountEl = document.getElementById('footerPriceAmount');
        if (amountEl) {
            amountEl.textContent = `$${costs.total.toFixed(0)}`;
        }

        const typeEl = document.getElementById('footerPriceType');
        if (typeEl) {
            typeEl.textContent = this.currentPricingModel === 'hourly'
                ? 'Hourly rate'
                : 'Flat rate guarantee';
        }

        const estimateLabel = document.getElementById('footerEstimateLabel');
        if (estimateLabel) {
            estimateLabel.textContent = this.quoteData.flexibleSchedule
                ? 'Estimate — flexible backloading'
                : 'Estimate — we will call to confirm';
        }
    }

    updateDiscountRow(discountAmount) {
        const row = document.getElementById('flexibleDiscountRow');
        const valueEl = document.getElementById('flexibleDiscount');
        if (!row || !valueEl) return;

        if (discountAmount && discountAmount > 0) {
            row.style.display = 'flex';
            valueEl.textContent = `-$${discountAmount.toFixed(2)}`;
        } else {
            row.style.display = 'none';
        }
    }

    updateEstimateMessaging(costs) {
        const noteEl = document.getElementById('estimateNote');
        if (!noteEl) return;

        if (costs.backloadDiscount && costs.backloadDiscount > 0) {
            noteEl.innerHTML = `<strong>Estimate with flexible scheduling</strong> A provisional backloading discount of $${costs.backloadDiscount.toFixed(2)} has been applied to labour and travel. Our move planners will call to confirm the best discounted window and lock in your final price.`;
        } else {
            noteEl.innerHTML = `<strong>Estimate only</strong> Our move planners will call shortly to confirm access, timing, and final pricing before we reserve the crew.`;
        }
    }

    displayHourlyQuote(costs) {
        // Update pricing model type
        document.getElementById('quotePriceType').textContent = 'Hourly Rate Quote';

        // Main price
        document.getElementById('quotePrice').textContent = `$${costs.total.toFixed(0)}`;

        // Labor cost
        document.getElementById('laborDescription').textContent =
            `${costs.handlingHours.toFixed(1)} hours × ${costs.hourlyRate}/hr (${this.quoteData.crewSize} movers)`;
        document.getElementById('laborCost').textContent = `$${costs.laborCost.toFixed(2)}`;

        // Travel cost
        document.getElementById('travelDescription').textContent =
            `${costs.travelHours.toFixed(1)} hours × $${costs.hourlyRate}/hr`;
        document.getElementById('travelCost').textContent = `$${costs.travelCost.toFixed(2)}`;

        this.updateDiscountRow(costs.backloadDiscount);

        // Surcharges
        document.getElementById('surchargesCost').textContent = `$${costs.totalSurcharges.toFixed(2)}`;

        // Tolls
        document.getElementById('tollsCost').textContent = `$${costs.tollsCost.toFixed(2)}`;

        // Total
        document.getElementById('totalQuote').textContent = `$${costs.total.toFixed(0)}`;
    }

    displayFlatRateQuote(costs) {
        // Update pricing model type
        document.getElementById('quotePriceType').textContent = 'Flat Rate Quote (Price Guaranteed)';

        // Main price
        document.getElementById('quotePrice').textContent = `$${costs.total.toFixed(0)}`;

        // Labor cost (show as bundled)
        document.getElementById('laborDescription').textContent =
            `Complete move (${costs.handlingHours.toFixed(1)}hrs handling + ${costs.travelHours.toFixed(1)}hrs travel)`;
        document.getElementById('laborCost').textContent = `$${(costs.laborCost + costs.travelCost).toFixed(2)}`;

        // Hide separate travel cost in flat rate
        document.getElementById('travelDescription').textContent =
            `Included in bundled price (${costs.travelHours.toFixed(1)} hours)`;
        document.getElementById('travelCost').textContent = `Included`;

        this.updateDiscountRow(costs.backloadDiscount);

        // Surcharges
        document.getElementById('surchargesCost').textContent = `$${costs.totalSurcharges.toFixed(2)}`;

        // Tolls
        document.getElementById('tollsCost').textContent = `$${costs.tollsCost.toFixed(2)}`;

        // Total
        document.getElementById('totalQuote').textContent = `$${costs.total.toFixed(0)}`;
    }

    displayTimeBreakdown() {
        const frictionCalc = this.quoteData.frictionCalculations;
        const loadingTime = this.quoteData.loadingTime.loadingHours * frictionCalc.timeMultiplier;
        const travelTime = this.quoteData.route.durationMinutes / 60;
        const unloadingTime = this.quoteData.loadingTime.unloadingHours * frictionCalc.timeMultiplier;
        const totalTime = loadingTime + travelTime + unloadingTime;

        document.getElementById('loadingTime').textContent = `${loadingTime.toFixed(1)} hours`;
        document.getElementById('travelTime').textContent = `${travelTime.toFixed(1)} hours`;
        document.getElementById('unloadingTime').textContent = `${unloadingTime.toFixed(1)} hours`;
        document.getElementById('totalDuration').textContent = `${totalTime.toFixed(1)} hours`;
    }

    displayInventory() {
        const items = this.quoteData.itemsDetails;
        const estimationMethod = this.quoteData.estimationMethod || 'inventory';
        const itemCountEl = document.getElementById('itemCount');
        const itemsSummaryEl = document.getElementById('itemsSummary');

        if (estimationMethod === 'volume' && (!items || items.length === 0)) {
            itemCountEl.textContent = 'Volume entry';
            itemsSummaryEl.innerHTML = `
                <div class="inventory-empty">Customer supplied ${this.quoteData.totalVolume.toFixed(2)} m³.<br>
                Inventory listing skipped.</div>
            `;
            return;
        }

        itemCountEl.textContent = items.length;

        const itemsHTML = items.map(item => `
            <div class="item-row">
                <span class="item-name">${item.name}</span>
                <span class="item-qty">×${item.quantity}</span>
            </div>
        `).join('');

        itemsSummaryEl.innerHTML = itemsHTML;
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

    initializeContactState() {
        const gate = document.getElementById('contactGate');
        const main = document.getElementById('quoteMain');
        const footer = document.getElementById('journeyFooter');
        const actionButtons = document.getElementById('actionButtons');
        const contactCard = document.getElementById('contactSummaryCard');

        const customer = this.quoteData.customer || null;
        const hasContact = customer && customer.email;

        if (hasContact) {
            if (gate) gate.classList.remove('active');
            if (main) main.classList.add('active');
            if (footer) footer.classList.add('active');
            if (actionButtons) actionButtons.style.display = 'grid';
            if (contactCard) contactCard.style.display = 'flex';
            this.updateContactDisplay(customer);
        } else {
            if (gate) gate.classList.add('active');
            if (main) main.classList.remove('active');
            if (footer) footer.classList.remove('active');
            if (actionButtons) actionButtons.style.display = 'none';
            if (contactCard) contactCard.style.display = 'none';
        }
    }

    updateContactDisplay(customer) {
        const nameDisplay = document.getElementById('customerNameDisplay');
        if (nameDisplay) {
            const name = customer && customer.name ? customer.name : 'Add contact details';
            nameDisplay.textContent = name;
        }

        if (customer) {
            this.populateContactSummary(customer);
        }
    }

    populateContactSummary(customer) {
        const name = customer.name || '—';
        const email = customer.email || '—';
        const phone = customer.phone || '—';

        const nameEl = document.getElementById('contactSummaryName');
        const emailEl = document.getElementById('contactSummaryEmail');
        const phoneEl = document.getElementById('contactSummaryPhone');

        if (nameEl) nameEl.textContent = name;
        if (emailEl) emailEl.textContent = email;
        if (phoneEl) phoneEl.textContent = phone;

        const contactCard = document.getElementById('contactSummaryCard');
        if (contactCard) contactCard.style.display = 'flex';

        const actionButtons = document.getElementById('actionButtons');
        if (actionButtons) actionButtons.style.display = 'grid';
    }

    buildEmailPayload(trigger) {
        const exportData = this.exportQuoteData();

        const summaryLines = [
            `Quote Reference: ${exportData.quoteReference}`,
            `Move Date: ${exportData.move.date || 'TBC'}`,
            `Pricing Model: ${exportData.pricingModel === 'hourly' ? 'Hourly Rate' : 'Flat Rate'}`,
            '',
            `Total Quote: $${exportData.costs.total.toFixed(2)}`,
            `Labor: $${exportData.costs.laborCost.toFixed(2)}`,
            `Travel: $${exportData.costs.travelCost.toFixed(2)}`,
            `Access Surcharges: $${exportData.costs.surcharges.toFixed(2)}`,
            `Tolls: $${exportData.costs.tolls.toFixed(2)}${exportData.costs.weekendPremium ? `\nWeekend Premium: $${exportData.costs.weekendPremium.toFixed(2)}` : ''}`,
            '',
            'Crew & Timing:',
            `- Crew Size: ${exportData.crew.size}`,
            `- Handling Hours: ${exportData.time.loadingHours.toFixed(1)}h`,
            `- Travel Hours: ${exportData.time.travelHours.toFixed(1)}h`,
            `- Total Estimated Hours: ${exportData.time.totalEstimatedHours.toFixed(1)}h`,
            '',
            'Inventory Summary:',
            `- Total Items: ${exportData.inventory.totalItems}`,
            `- Total Volume: ${exportData.inventory.totalVolume.toFixed(2)} m³`
        ];

        return {
            to: exportData.customer.email,
            name: exportData.customer.name,
            trigger,
            subject: `Sam Removals Quote - ${exportData.quoteReference}`,
            overview: summaryLines.join('\n'),
            quote: exportData
        };
    }

    async sendQuoteEmail(trigger = 'manual') {
        const customer = this.quoteData.customer;
        if (!customer || !customer.email) {
            throw new Error('Missing customer email');
        }

        if (!this.EMAIL_ENDPOINT) {
            throw new Error('EMAIL_ENDPOINT not configured. Set window.SAM_REMOVALS_EMAIL_ENDPOINT.');
        }

        const payload = this.buildEmailPayload(trigger);

        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.EMAIL_API_KEY) {
            headers.Authorization = `Bearer ${this.EMAIL_API_KEY}`;
        }

        const response = await fetch(this.EMAIL_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || 'Failed to send email');
        }

        return response.json().catch(() => true);
    }

    switchPricingModel(model) {
        this.currentPricingModel = model;

        // Update button states
        document.getElementById('hourlyBtn').classList.toggle('active', model === 'hourly');
        document.getElementById('flatBtn').classList.toggle('active', model === 'flat');

        // Recalculate and display
        this.calculateAndDisplayQuote();
    }

    exportQuoteData() {
        const costs = this.currentPricingModel === 'hourly' ?
            this.calculateHourlyCosts() :
            this.calculateFlatRateCosts();

        return {
            quoteReference: this.quoteReference,
            pricingModel: this.currentPricingModel,
            customer: {
                name: this.quoteData.customer?.name || this.quoteData.customerName || '',
                email: this.quoteData.customer?.email || '',
                phone: this.quoteData.customer?.phone || ''
            },
            move: {
                date: this.quoteData.moveDate,
                time: this.quoteData.moveTime,
                isWeekend: this.quoteData.isWeekend,
                origin: this.quoteData.origin,
                destination: this.quoteData.destination
            },
            inventory: {
                totalItems: this.quoteData.totalItems,
                totalVolume: this.quoteData.totalVolume,
                items: this.quoteData.itemsDetails
            },
            route: {
                distanceKm: this.quoteData.route.distanceKm,
                durationMinutes: this.quoteData.route.durationMinutes,
                tollCost: this.quoteData.route.estimatedTollCost
            },
            crew: {
                size: this.quoteData.crewSize,
                hourlyRate: costs.hourlyRate
            },
            access: {
                notes: this.quoteData.frictionNotes || this.quoteData.accessNotes || '',
                flexibleSchedule: !!this.quoteData.flexibleSchedule
            },
            time: {
                loadingHours: this.quoteData.loadingTime.loadingHours,
                travelHours: costs.travelHours,
                unloadingHours: this.quoteData.loadingTime.unloadingHours,
                frictionMultiplier: this.quoteData.frictionCalculations.timeMultiplier,
                totalEstimatedHours: this.quoteData.frictionCalculations.totalEstimatedHours
            },
            costs: {
                laborCost: costs.laborCost,
                travelCost: costs.travelCost,
                surcharges: costs.totalSurcharges,
                tolls: costs.tollsCost,
                weekendPremium: costs.weekendPremium || 0,
                riskPremium: costs.riskPremium || 0,
                subtotalBeforeDiscount: costs.subtotalBeforeDiscount || costs.subtotal,
                flexibleDiscount: costs.backloadDiscount || 0,
                subtotal: costs.subtotal,
                total: costs.total
            },
            generatedAt: new Date().toISOString()
        };
    }
}

// Global functions for UI interactions
function switchPricingModel(model) {
    if (window.finalQuoteCalc) {
        window.finalQuoteCalc.switchPricingModel(model);
    }
}

async function submitContactDetails() {
    // Get contact details
    const name = document.getElementById('customerNameInput').value.trim();
    const email = document.getElementById('customerEmailInput').value.trim();
    const phone = document.getElementById('customerPhoneInput').value.trim();

    // Validate
    if (!name || name.length < 2) {
        alert('Please enter your full name');
        document.getElementById('customerNameInput').focus();
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        alert('Please enter a valid email address');
        document.getElementById('customerEmailInput').focus();
        return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone || phoneDigits.length !== 10 || !phoneDigits.startsWith('04')) {
        alert('Please enter a valid Australian mobile number (04XX XXX XXX)');
        document.getElementById('customerPhoneInput').focus();
        return;
    }

    // Save customer details to quote data
    const quoteData = JSON.parse(localStorage.getItem('samRemovals_quoteData'));
    quoteData.customer = {
        name: name,
        email: email,
        phone: phone,
        submittedAt: new Date().toISOString()
    };
    quoteData.customerName = name;
    localStorage.setItem('samRemovals_quoteData', JSON.stringify(quoteData));

    // Update the global calculator with customer data
    if (window.finalQuoteCalc) {
        window.finalQuoteCalc.quoteData.customer = quoteData.customer;
        window.finalQuoteCalc.quoteData.customerName = name;
        window.finalQuoteCalc.updateContactDisplay(quoteData.customer);
        window.finalQuoteCalc.initializeContactState();
        window.finalQuoteCalc.displayMoveDetails();
    }

    try {
        await window.finalQuoteCalc.sendQuoteEmail('contact-submit');
        alert(`✅ Quote sent to ${email}. Your personalised quote is now unlocked below.`);
    } catch (error) {
        console.error('Email delivery failed:', error);
        alert('Your quote is ready below, but the email could not be delivered automatically. Please try “Send to email” again or contact support.');
    }
}

function editContactDetails() {
    if (!window.finalQuoteCalc) return;

    const gate = document.getElementById('contactGate');
    const main = document.getElementById('quoteMain');
    const footer = document.getElementById('journeyFooter');

    if (main) main.classList.remove('active');
    if (footer) footer.classList.remove('active');
    if (gate) gate.classList.add('active');

    const { customer } = window.finalQuoteCalc.quoteData;

    document.getElementById('customerNameInput').value = customer?.name || '';
    document.getElementById('customerEmailInput').value = customer?.email || '';
    document.getElementById('customerPhoneInput').value = customer?.phone || '';

    document.getElementById('customerNameInput').focus();
}

async function emailQuote() {
    if (!window.finalQuoteCalc) return;

    const quoteData = window.finalQuoteCalc.exportQuoteData();

    // Check if customer data exists
    if (!quoteData.customer || !quoteData.customer.email) {
        alert('Please enter your contact details first to receive the quote.');
        return;
    }

    try {
        await window.finalQuoteCalc.sendQuoteEmail('manual-resend');
        alert(`✅ Quote sent to ${quoteData.customer.email}`);
    } catch (error) {
        console.error('Email delivery failed:', error);
        alert('We could not send the email automatically. Please try again shortly or reach out to support.');
    }
}

function acceptQuote() {
    if (!window.finalQuoteCalc) return;

    const quoteData = window.finalQuoteCalc.exportQuoteData();

    // In production, this would POST to backend API
    console.log('Quote Accepted:', quoteData);

    // Save to localStorage for booking flow
    localStorage.setItem('samRemovals_acceptedQuote', JSON.stringify(quoteData));

    alert(`✓ Quote Accepted!\n\nReference: ${quoteData.quoteReference}\nTotal: $${quoteData.costs.total.toFixed(2)}\n\nOur team will contact you shortly to confirm your booking.`);

    // In production: window.location.href = '/booking-confirmation';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.finalQuoteCalc = new FinalQuoteCalculator();

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'quote-friction.html';
        });
    }

    // Phone number formatting
    const phoneInput = document.getElementById('customerPhoneInput');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.slice(0, 10);

            // Format as 04XX XXX XXX
            if (value.length >= 6) {
                value = value.slice(0, 4) + ' ' + value.slice(4, 7) + ' ' + value.slice(7);
            } else if (value.length >= 4) {
                value = value.slice(0, 4) + ' ' + value.slice(4);
            }

            e.target.value = value;
        });
    }

    // Expose export function for debugging
    window.exportQuoteData = () => {
        console.log(JSON.stringify(window.finalQuoteCalc.exportQuoteData(), null, 2));
    };
});
