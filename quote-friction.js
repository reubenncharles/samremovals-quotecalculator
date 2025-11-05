// Sam Removals - Access Notes Capture
// Collects free-form access information and keeps move timing neutral

class FrictionCalculator {
    constructor() {
        this.quoteData = this.loadQuoteData();
        this.notesInput = null;
        this.notesPreview = null;
        this.footerNotesPreview = null;
        this.init();
    }

    init() {
        if (!this.quoteData) return;

        this.cacheElements();
        this.restoreNotes();
        this.setupEventListeners();
        this.updateSummary();
        this.setupProgressNavigation(3);
    }

    cacheElements() {
        this.notesInput = document.getElementById('accessNotes');
        this.notesPreview = document.getElementById('notesPreview');
        this.footerNotesPreview = document.getElementById('footerNotesPreview');
    }

    loadQuoteData() {
        const data = localStorage.getItem('samRemovals_quoteData');
        if (!data) {
            alert('No quote data found. Redirecting to start...');
            window.location.href = 'quote-calculator.html';
            return null;
        }
        return JSON.parse(data);
    }

    restoreNotes() {
        if (!this.notesInput) return;
        const savedNotes = this.quoteData.frictionNotes || this.quoteData.accessNotes || '';
        this.notesInput.value = savedNotes;
    }

    setupEventListeners() {
        const backBtn = document.getElementById('backBtn');
        const continueBtn = document.getElementById('continueBtn');

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'quote-locations.html';
            });
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.handleContinue());
        }

        if (this.notesInput) {
            this.notesInput.addEventListener('input', () => this.updateSummary());
        }
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

    getNotes() {
        return (this.notesInput ? this.notesInput.value : '').trim();
    }

    truncate(text, max = 140) {
        if (text.length <= max) return text;
        return `${text.slice(0, max - 1)}…`;
    }

    updateSummary() {
        this.updateNotesPreview();
        this.updateTimeSummary();
    }

    updateNotesPreview() {
        const notes = this.getNotes();
        const defaultMessage = 'No access notes added yet. Mention stairs, parking, lift bookings, or anything unusual so we can prepare the crew.';

        if (this.notesPreview) {
            this.notesPreview.textContent = notes || defaultMessage;
        }

        if (this.footerNotesPreview) {
            this.footerNotesPreview.textContent = notes
                ? this.truncate(notes, 160)
                : 'Add a brief note so our move planner can double-check access before the crew arrives.';
        }
    }

    updateTimeSummary() {
        const time = this.calculateAdjustedTime();

        const summaryBase = document.getElementById('summaryBaseTime');
        if (summaryBase) {
            summaryBase.textContent = `${time.baseHandlingHours.toFixed(1)} hrs`;
        }

        const summaryFriction = document.getElementById('summaryFrictionTime');
        if (summaryFriction) {
            summaryFriction.textContent = '+0.0 hrs';
        }

        const summaryAdjusted = document.getElementById('summaryAdjustedTime');
        if (summaryAdjusted) {
            summaryAdjusted.textContent = `${time.totalEstimatedHours.toFixed(1)} hrs`;
        }
    }

    calculateAdjustedTime() {
        const baseHandlingHours = this.quoteData.loadingTime?.totalHandlingHours || 0;
        const travelHours = this.quoteData.route
            ? (this.quoteData.route.durationMinutes || 0) / 60
            : 0;

        return {
            baseHandlingHours,
            travelHours,
            totalEstimatedHours: baseHandlingHours + travelHours
        };
    }

    handleContinue() {
        const notes = this.getNotes();
        const time = this.calculateAdjustedTime();

        const completeQuoteData = {
            ...this.quoteData,
            frictionNotes: notes,
            accessNotes: notes,
            frictionCalculations: {
                timeMultiplier: 1,
                adjustedHandlingHours: time.baseHandlingHours,
                frictionDelay: 0,
                totalEstimatedHours: time.totalEstimatedHours
            },
            surcharges: {
                stairs: 0,
                access: 0,
                totalFriction: 0,
                specialtyItems: this.quoteData.specialtySurcharges || 0
            },
            frictionFactors: {
                notes,
                flexibleSchedule: !!this.quoteData.flexibleSchedule
            },
            step: 4,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem('samRemovals_quoteData', JSON.stringify(completeQuoteData));
        window.location.href = 'quote-final.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.frictionCalculator = new FrictionCalculator();
});
