// Sam Removals - Location & Route Calculator
// Handles geospatial calculations, toll estimation, and schedule validation

class LocationCalculator {
    constructor() {
        this.quoteData = this.loadQuoteData();
        this.routeData = null;
        this.formValid = false;

        // API Configuration (will be moved to environment variables in production)
        this.GOOGLE_MAPS_API_KEY = 'AIzaSyArJKHYV64NCjyK7rH1tor1YpAFk1bCpmc'; // Distance Matrix API key

        // Map and autocomplete
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.originAutocomplete = null;
        this.destinationAutocomplete = null;

        this.init();
    }

    init() {
        this.loadInventorySummary();
        this.initializeMap();
        this.setupAutocomplete();
        this.setupEventListeners();
        this.setupValidation();
        this.setMinDate();
        this.restoreFlexibleState();
        this.showMapContainer(); // Show map on load
        this.setupProgressNavigation(1);
    }

    initializeMap() {
        try {
            // Initialize map centered on Sydney
            const sydney = { lat: -33.8688, lng: 151.2093 };

            this.map = new google.maps.Map(document.getElementById('map'), {
                zoom: 10,
                center: sydney,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                streetViewControl: false,
                fullscreenControl: true
            });

            // Initialize directions service and renderer
            this.directionsService = new google.maps.DirectionsService();
            this.directionsRenderer = new google.maps.DirectionsRenderer({
                map: this.map,
                panel: null,
                suppressMarkers: false,
                polylineOptions: {
                    strokeColor: '#2563eb',
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                }
            });

            console.log('🗺️  Map initialized successfully');
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            console.error('   Please check Google Cloud Console:');
            console.error('   1. Billing is enabled');
            console.error('   2. Maps JavaScript API is enabled');
            console.error('   3. API key restrictions allow this domain');
        }
    }

    setupAutocomplete() {
        try {
            // Restrict autocomplete to Australia
            const options = {
                componentRestrictions: { country: 'au' },
                fields: ['address_components', 'formatted_address', 'geometry', 'name'],
                types: ['address']
            };

            // Origin autocomplete
            const originInput = document.getElementById('originAddress');
            this.originAutocomplete = new google.maps.places.Autocomplete(originInput, options);

            this.originAutocomplete.addListener('place_changed', () => {
                const place = this.originAutocomplete.getPlace();
                if (place.geometry) {
                    this.fillAddressFields('origin', place);
                    console.log('📍 Origin selected:', place.formatted_address);
                }
            });

            // Destination autocomplete
            const destInput = document.getElementById('destAddress');
            this.destinationAutocomplete = new google.maps.places.Autocomplete(destInput, options);

            this.destinationAutocomplete.addListener('place_changed', () => {
                const place = this.destinationAutocomplete.getPlace();
                if (place.geometry) {
                    this.fillAddressFields('destination', place);
                    console.log('📍 Destination selected:', place.formatted_address);
                }
            });

            console.log('✅ Address autocomplete enabled');
        } catch (error) {
            console.error('❌ Autocomplete initialization failed:', error);
            console.warn('⚠️  Address autocomplete disabled - manual entry required');
        }
    }

    fillAddressFields(type, place) {
        // Extract address components
        const addressComponents = place.address_components;
        let suburb = '';
        let postcode = '';
        let state = '';

        for (const component of addressComponents) {
            const types = component.types;

            if (types.includes('locality')) {
                suburb = component.long_name;
            }
            if (types.includes('postal_code')) {
                postcode = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
                state = component.short_name;
            }
        }

        // Fill in the fields
        const prefix = type === 'origin' ? 'origin' : 'dest';

        if (suburb) document.getElementById(`${prefix}Suburb`).value = suburb;
        if (postcode) document.getElementById(`${prefix}Postcode`).value = postcode;
        if (state) document.getElementById(`${prefix}State`).value = state;

        console.log(`  Auto-filled ${type}:`, { suburb, postcode, state });

        // Trigger auto-calculation after autocomplete
        this.autoCalculateRoute();
    }

    loadQuoteData() {
        const data = localStorage.getItem('samRemovals_quoteData');
        if (!data) {
            alert('No inventory data found. Redirecting to inventory page...');
            window.location.href = 'quote-calculator.html';
            return null;
        }
        return JSON.parse(data);
    }

    loadInventorySummary() {
        if (!this.quoteData) return;

        const estimationMethod = this.quoteData.estimationMethod || 'inventory';

        const summaryItemsEl = document.getElementById('summaryItems');
        if (estimationMethod === 'volume') {
            summaryItemsEl.textContent = 'Volume entry';
        } else {
            summaryItemsEl.textContent = this.quoteData.totalItems;
        }

        document.getElementById('summaryVolume').textContent = `${this.quoteData.totalVolume.toFixed(2)} m³`;
        document.getElementById('summaryCrew').textContent =
            `${this.quoteData.crewSize} mover${this.quoteData.crewSize > 1 ? 's' : ''}`;

        const loadingTime = this.quoteData.loadingTime;
        document.getElementById('summaryLoading').textContent =
            `${loadingTime.loadingHours.toFixed(1)} hrs`;
        document.getElementById('summaryUnloading').textContent =
            `${loadingTime.unloadingHours.toFixed(1)} hrs`;
        document.getElementById('summaryTotalTime').textContent =
            `${loadingTime.totalHandlingHours.toFixed(1)} hrs`;

        const summaryTravel = document.getElementById('summaryTravel');
        if (summaryTravel) {
            summaryTravel.textContent = '0h 0m';
        }

        this.updateInventoryVitals();
        this.updateFooterMoveDate(document.getElementById('moveDate')?.value || '');
        this.updateFlexibleSummary();
    }

    updateInventoryVitals() {
        if (!this.quoteData) return;

        const estimationMethod = this.quoteData.estimationMethod || 'inventory';
        const itemsLabel = this.quoteData.totalItems === 1 ? 'item' : 'items';
        const volumeLabel = `${this.quoteData.totalVolume.toFixed(2)} m³`;
        const crewLabel = `${this.quoteData.crewSize} mover${this.quoteData.crewSize > 1 ? 's' : ''}`;

        const heroItems = document.getElementById('heroItemsCount');
        if (heroItems) {
            heroItems.textContent = estimationMethod === 'volume'
                ? 'Volume entry'
                : `${this.quoteData.totalItems} ${itemsLabel}`;
        }

        const heroVolume = document.getElementById('heroVolume');
        if (heroVolume) heroVolume.textContent = volumeLabel;

        const heroCrew = document.getElementById('heroCrew');
        if (heroCrew) heroCrew.textContent = crewLabel;

        const heroFlex = document.getElementById('heroFlex');
        if (heroFlex) {
            heroFlex.textContent = this.quoteData.flexibleSchedule
                ? 'Flexible window'
                : 'Fixed schedule';
        }

        const footerItems = document.getElementById('footerItems');
        if (footerItems) {
            footerItems.textContent = estimationMethod === 'volume'
                ? 'Volume entry'
                : `${this.quoteData.totalItems} ${itemsLabel}`;
        }

        const footerVolume = document.getElementById('footerVolume');
        if (footerVolume) footerVolume.textContent = volumeLabel;

        const footerRoute = document.getElementById('footerRoute');
        if (footerRoute && !this.routeData) {
            footerRoute.textContent = 'Pending';
        }
    }

    updateFooterMoveDate(dateValue) {
        const footerMoveDate = document.getElementById('footerMoveDate');
        if (!footerMoveDate) return;

        if (!dateValue) {
            footerMoveDate.textContent = 'Not set';
            return;
        }

        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) {
            footerMoveDate.textContent = dateValue;
            return;
        }

        const formatted = parsed.toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        footerMoveDate.textContent = formatted;
    }

    updateFooterRoute(routeData) {
        const footerRoute = document.getElementById('footerRoute');
        if (!footerRoute) return;

        if (!routeData) {
            footerRoute.textContent = 'Pending';
            return;
        }

        footerRoute.textContent =
            `${routeData.distanceKm} km · ${this.formatDuration(routeData.durationMinutes)}`;
    }

    formatDuration(minutes) {
        if (!minutes && minutes !== 0) return '--';
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hrs}h ${mins}m`;
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'quote-calculator.html';
        });

        document.getElementById('continueBtn').addEventListener('click', () => {
            this.handleContinue();
        });

        // Date change - check for weekend
        document.getElementById('moveDate').addEventListener('change', (e) => {
            this.checkWeekend(e.target.value);
            this.updateFooterMoveDate(e.target.value);
        });

        // Real-time validation
        const inputs = document.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.checkFormCompletion());
        });

        // Auto-calculate route when addresses are complete
        const addressFields = [
            'originAddress', 'originSuburb', 'originPostcode', 'originState',
            'destAddress', 'destSuburb', 'destPostcode', 'destState'
        ];

        addressFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            field.addEventListener('change', () => {
                this.autoCalculateRoute();
            });
            field.addEventListener('blur', () => {
                this.autoCalculateRoute();
            });
        });

        const flexibleToggle = document.getElementById('flexibleSchedule');
        if (flexibleToggle) {
            flexibleToggle.addEventListener('change', () => this.updateFlexibleSummary());
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

    setupValidation() {
        // Postcode validation
        ['originPostcode', 'destPostcode'].forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
            });
        });
    }

    setMinDate() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const minDate = tomorrow.toISOString().split('T')[0];
        document.getElementById('moveDate').setAttribute('min', minDate);
    }

    validateField(input) {
        const value = input.value.trim();
        let isValid = true;
        let errorMsg = '';

        switch(input.id) {
            case 'originPostcode':
            case 'destPostcode':
                isValid = value.length === 4 && !isNaN(value);
                errorMsg = 'Please enter a valid 4-digit postcode';
                break;

            default:
                isValid = value.length > 0;
                errorMsg = 'This field is required';
        }

        if (isValid) {
            input.classList.remove('error');
        } else {
            input.classList.add('error');
        }

        return isValid;
    }

    checkWeekend(dateString) {
        const date = new Date(dateString);
        const day = date.getDay();
        const isWeekend = (day === 0 || day === 6); // 0 = Sunday, 6 = Saturday

        const weekendNotice = document.getElementById('weekendNotice');
        if (isWeekend) {
            weekendNotice.classList.add('show');
        } else {
            weekendNotice.classList.remove('show');
        }

        return isWeekend;
    }

    checkFormCompletion() {
        const requiredFields = document.querySelectorAll('input[required], select[required]');
        let allValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                allValid = false;
            }
        });

        // Also need route calculated
        const continueBtn = document.getElementById('continueBtn');
        if (allValid && this.routeData) {
            continueBtn.disabled = false;
            this.formValid = true;
        } else {
            continueBtn.disabled = true;
            this.formValid = false;
        }
    }

    showMapContainer() {
        // Always show map container
        document.getElementById('mapContainer').style.display = 'block';
    }

    autoCalculateRoute() {
        // Check if all address fields are filled
        const originAddress = document.getElementById('originAddress').value.trim();
        const originSuburb = document.getElementById('originSuburb').value.trim();
        const originPostcode = document.getElementById('originPostcode').value.trim();
        const originState = document.getElementById('originState').value;

        const destAddress = document.getElementById('destAddress').value.trim();
        const destSuburb = document.getElementById('destSuburb').value.trim();
        const destPostcode = document.getElementById('destPostcode').value.trim();
        const destState = document.getElementById('destState').value;

        console.log('🔍 Checking if all address fields filled...');
        console.log('  Origin:', { originAddress, originSuburb, originPostcode, originState });
        console.log('  Destination:', { destAddress, destSuburb, destPostcode, destState });

        // Only calculate if all fields are filled
        if (originAddress && originSuburb && originPostcode && originState &&
            destAddress && destSuburb && destPostcode && destState) {

            console.log('✅ All fields filled! Auto-calculating in 1 second...');

            // Debounce the calculation (wait 1 second after last input)
            clearTimeout(this.autoCalculateTimeout);
            this.autoCalculateTimeout = setTimeout(() => {
                console.log('🔄 Auto-calculating route...');
                this.calculateRoute(true); // Pass true for silent mode
            }, 1000);
        } else {
            console.log('⏳ Waiting for all fields to be filled...');
        }
    }

    async calculateRoute(silent = false) {
        // Validate addresses first
        const originAddress = document.getElementById('originAddress').value.trim();
        const originSuburb = document.getElementById('originSuburb').value.trim();
        const originPostcode = document.getElementById('originPostcode').value.trim();
        const originState = document.getElementById('originState').value;

        const destAddress = document.getElementById('destAddress').value.trim();
        const destSuburb = document.getElementById('destSuburb').value.trim();
        const destPostcode = document.getElementById('destPostcode').value.trim();
        const destState = document.getElementById('destState').value;

        if (!originAddress || !originSuburb || !originPostcode || !destAddress || !destSuburb || !destPostcode) {
            if (!silent) {
                alert('Please fill in all address fields before calculating route.');
            }
            return;
        }

        try {
            // Build full addresses
            const origin = `${originAddress}, ${originSuburb} ${originState} ${originPostcode}, Australia`;
            const destination = `${destAddress}, ${destSuburb} ${destState} ${destPostcode}, Australia`;

            // Get route data from Google Distance Matrix API
            const routeData = await this.getDistanceMatrix(origin, destination);

            if (routeData.success) {
                this.routeData = routeData;

                // Calculate toll costs based on route
                const tollCost = this.estimateTollCosts(routeData.distanceKm, originPostcode, destPostcode);
                this.routeData.estimatedTollCost = tollCost;

                this.displayRouteInfo(routeData, tollCost);
                this.displayRouteOnMap(origin, destination);
                this.updateSummary();
                this.checkFormCompletion();

                // Show warning if using fallback
                if (routeData.warning) {
                    console.warn('Route calculation warning:', routeData.warning);
                }
            } else {
                alert('Unable to calculate route. Please check addresses and try again.\n\n' + routeData.error);
            }

        } catch (error) {
            console.error('Route calculation error:', error);
            if (!silent) {
                alert('Error calculating route. Please try again.');
            }
        }
    }

    async getDistanceMatrix(origin, destination) {
        // IMPORTANT: In production, move this to a backend API to protect the API key
        // For now, we're calling Google directly from the frontend for testing

        console.log('🚗 Distance Matrix API Request:');
        console.log('  Origin:', origin);
        console.log('  Destination:', destination);

        try {
            // Use Google Distance Matrix API
            const service = new google.maps.DistanceMatrixService();
            console.log('  ✓ Distance Matrix Service initialized');

            const request = {
                origins: [origin],
                destinations: [destination],
                travelMode: google.maps.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(Date.now() + 60000), // 1 min from now for traffic
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                },
                unitSystem: google.maps.UnitSystem.METRIC
            };

            // Promisify the callback-based API
            console.log('  ⏳ Calling Google Distance Matrix API...');
            const response = await new Promise((resolve, reject) => {
                service.getDistanceMatrix(request, (response, status) => {
                    console.log('  📡 API Response Status:', status);
                    if (status === 'OK') {
                        console.log('  ✅ API call successful!');
                        resolve(response);
                    } else {
                        console.error('  ❌ API Error:', status);
                        reject(new Error(`Distance Matrix API error: ${status}`));
                    }
                });
            });

            // Extract data from response
            const element = response.rows[0].elements[0];

            if (element.status !== 'OK') {
                throw new Error(`Route calculation failed: ${element.status}`);
            }

            // Parse distance and duration
            const distanceKm = Math.round(element.distance.value / 1000); // meters to km
            const durationMinutes = Math.round(element.duration.value / 60); // seconds to minutes
            const durationInTrafficMinutes = element.duration_in_traffic
                ? Math.round(element.duration_in_traffic.value / 60)
                : durationMinutes;

            console.log('  📊 Results:');
            console.log('    Distance:', distanceKm, 'km (' + element.distance.text + ')');
            console.log('    Duration (no traffic):', durationMinutes, 'min');
            console.log('    Duration (with traffic):', durationInTrafficMinutes, 'min');
            console.log('    Traffic conditions:', element.duration_in_traffic ? 'LIVE' : 'ESTIMATED');

            const result = {
                success: true,
                origin: origin,
                destination: destination,
                distanceKm: distanceKm,
                distanceText: element.distance.text,
                durationMinutes: durationInTrafficMinutes,
                durationText: `${Math.floor(durationInTrafficMinutes / 60)}h ${durationInTrafficMinutes % 60}m`,
                trafficConditions: element.duration_in_traffic ? 'live' : 'estimated',
                calculatedAt: new Date().toISOString()
            };

            console.log('  ✅ Returning result:', result);
            return result;

        } catch (error) {
            console.error('❌ Distance Matrix API Error:', error);
            console.error('   Error details:', error.message);

            // Fallback to mock calculation if API fails
            console.warn('⚠️  Falling back to mock distance calculation...');
            const mockDistance = this.getMockDistance(origin, destination);
            console.log('   Mock calculation:', mockDistance);

            return {
                success: true,
                origin: origin,
                destination: destination,
                distanceKm: mockDistance.km,
                distanceText: `${mockDistance.km} km`,
                durationMinutes: mockDistance.minutes,
                durationText: `${Math.floor(mockDistance.minutes / 60)}h ${mockDistance.minutes % 60}m`,
                trafficConditions: 'estimated (fallback)',
                calculatedAt: new Date().toISOString(),
                warning: 'Using estimated values - API unavailable'
            };
        }
    }

    getMockDistance(origin, destination) {
        // Extract postcodes for mock calculation
        const originMatch = origin.match(/\d{4}/);
        const destMatch = destination.match(/\d{4}/);

        if (!originMatch || !destMatch) {
            return { km: 25, minutes: 45 };
        }

        const originCode = parseInt(originMatch[0]);
        const destCode = parseInt(destMatch[0]);

        // More accurate Sydney distance estimation based on postcode difference
        // Sydney postcodes: 2000-2999 (metro), with different zones
        const diff = Math.abs(originCode - destCode);

        // Improved formula: smaller multiplier for more realistic distances
        // Average: 0.25-0.3 km per postcode unit difference
        const km = Math.min(5 + (diff * 0.28), 150); // Cap at 150km for interstate

        // Time estimation: ~1.5-2 min per km in Sydney traffic
        const baseMinutes = Math.round(km * 1.8); // 1.8 min/km average

        // Add traffic factor (1.1x to 1.3x) - using 1.2x for moderate traffic
        const trafficMultiplier = 1.2;
        const minutes = Math.round(baseMinutes * trafficMultiplier);

        return {
            km: Math.round(km),
            minutes: minutes
        };
    }

    estimateTollCosts(distanceKm, originPostcode, destPostcode) {
        // Sydney toll road estimation based on route
        // Major toll corridors:
        // - M4 (Western Sydney): ~$10-31 for Class B
        // - M7 (Orbital): ~$10-15
        // - M2 (Hills Motorway): ~$8-10
        // - Eastern Distributor: ~$8
        // - Cross City Tunnel: ~$6
        // - Lane Cove Tunnel: ~$3-4

        const origin = parseInt(originPostcode);
        const dest = parseInt(destPostcode);

        // Simple heuristic based on postcodes and distance
        let estimatedTolls = 0;

        // Long distance likely uses M4/M7
        if (distanceKm > 40) {
            estimatedTolls += 25; // M4 or M7 usage
        } else if (distanceKm > 20) {
            estimatedTolls += 12; // Likely one major toll road
        }

        // CBD routes (2000-2010)
        if ((origin >= 2000 && origin <= 2010) || (dest >= 2000 && dest <= 2010)) {
            estimatedTolls += 8; // Eastern Distributor or Cross City Tunnel
        }

        // North Shore routes (2060-2120)
        if ((origin >= 2060 && origin <= 2120) || (dest >= 2060 && dest <= 2120)) {
            estimatedTolls += 4; // Lane Cove Tunnel
        }

        // Western Sydney (2150-2770)
        if ((origin >= 2150 && origin <= 2770) || (dest >= 2150 && dest <= 2770)) {
            estimatedTolls += 15; // M4 corridor
        }

        // Cap at reasonable maximum
        return Math.min(estimatedTolls, 50);
    }

    displayRouteInfo(routeData, tollCost) {
        document.getElementById('routeDistance').textContent = `${routeData.distanceKm} km`;
        document.getElementById('routeTravelTime').textContent =
            this.formatDuration(routeData.durationMinutes);
        document.getElementById('routeTolls').textContent = `$${tollCost.toFixed(2)}`;

        document.getElementById('routeInfoBox').classList.add('show');
        this.updateFooterRoute(routeData);
    }

    displayRouteOnMap(origin, destination) {
        console.log('🗺️  Attempting to display route on map...');
        console.log('   Origin:', origin);
        console.log('   Destination:', destination);

        // Check if services are initialized
        if (!this.directionsService || !this.directionsRenderer) {
            console.error('❌ Directions service or renderer not initialized!');
            console.log('   Attempting to reinitialize...');

            try {
                this.directionsService = new google.maps.DirectionsService();
                this.directionsRenderer = new google.maps.DirectionsRenderer({
                    map: this.map,
                    polylineOptions: {
                        strokeColor: '#2563eb',
                        strokeWeight: 5,
                        strokeOpacity: 0.8
                    }
                });
                console.log('✅ Services reinitialized');
            } catch (error) {
                console.error('❌ Failed to reinitialize:', error);
                return;
            }
        }

        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: {
                departureTime: new Date(Date.now() + 60000),
                trafficModel: google.maps.TrafficModel.BEST_GUESS
            },
            provideRouteAlternatives: false
        };

        console.log('📡 Sending directions request...');

        this.directionsService.route(request, (result, status) => {
            console.log('📡 Directions API response status:', status);

            if (status === 'OK') {
                console.log('✅ Route calculation successful!');

                // Display the route
                this.directionsRenderer.setDirections(result);

                // Log route details
                const route = result.routes[0];
                const leg = route.legs[0];
                console.log('📊 Route details:', {
                    distance: leg.distance.text,
                    duration: leg.duration.text,
                    steps: leg.steps.length,
                    startLocation: leg.start_address,
                    endLocation: leg.end_address
                });

                console.log('✅ Route should now be visible on map!');

            } else {
                console.error('❌ Directions request failed!');
                console.error('   Status:', status);
                console.error('   This means the route line won\'t appear on the map');
                console.error('   Common causes:');
                console.error('   - OVER_QUERY_LIMIT: API quota exceeded');
                console.error('   - REQUEST_DENIED: Directions API not enabled');
                console.error('   - ZERO_RESULTS: No route found between locations');
                console.error('   - INVALID_REQUEST: Missing or invalid parameters');

                // Still show the map centered between the two locations
                this.centerMapBetweenLocations(origin, destination);
            }
        });
    }

    centerMapBetweenLocations(origin, destination) {
        // Fallback: center map between origin and destination if route fails
        console.log('📍 Centering map between locations as fallback...');
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ address: origin }, (results1, status1) => {
            if (status1 === 'OK') {
                geocoder.geocode({ address: destination }, (results2, status2) => {
                    if (status2 === 'OK') {
                        const bounds = new google.maps.LatLngBounds();
                        bounds.extend(results1[0].geometry.location);
                        bounds.extend(results2[0].geometry.location);
                        this.map.fitBounds(bounds);
                        console.log('✅ Map centered between locations');
                    }
                });
            }
        });
    }

    updateSummary() {
        this.updateFlexibleSummary();

        if (!this.routeData) return;

        const travelLabel = this.formatDuration(this.routeData.durationMinutes);
        const summaryTravel = document.getElementById('summaryTravel');
        if (summaryTravel) {
            summaryTravel.textContent = travelLabel;
        }

        const travelHours = this.routeData.durationMinutes / 60;
        const totalTime = this.quoteData.loadingTime.totalHandlingHours + travelHours;
        document.getElementById('summaryTotalTime').textContent = `${totalTime.toFixed(1)} hrs`;

        this.updateFooterRoute(this.routeData);
    }

    collectFormData() {
        return {
            // Schedule
            moveDate: document.getElementById('moveDate').value,
            moveTime: document.getElementById('moveTime').value || null,
            isWeekend: this.checkWeekend(document.getElementById('moveDate').value),

            // Addresses
            origin: {
                address: document.getElementById('originAddress').value.trim(),
                suburb: document.getElementById('originSuburb').value.trim(),
                postcode: document.getElementById('originPostcode').value.trim(),
                state: document.getElementById('originState').value,
                fullAddress: this.buildFullAddress('origin')
            },
            destination: {
                address: document.getElementById('destAddress').value.trim(),
                suburb: document.getElementById('destSuburb').value.trim(),
                postcode: document.getElementById('destPostcode').value.trim(),
                state: document.getElementById('destState').value,
                fullAddress: this.buildFullAddress('destination')
            },

            // Route data
            route: {
                distanceKm: this.routeData.distanceKm,
                durationMinutes: this.routeData.durationMinutes,
                estimatedTollCost: this.routeData.estimatedTollCost,
                calculatedAt: this.routeData.calculatedAt
            },
            flexibleSchedule: this.isFlexibleSchedule()
        };
    }

    isFlexibleSchedule() {
        const checkbox = document.getElementById('flexibleSchedule');
        return checkbox ? checkbox.checked : false;
    }

    updateFlexibleSummary() {
        const isFlexible = this.isFlexibleSchedule();

        const summaryFlex = document.getElementById('summaryFlex');
        if (summaryFlex) {
            summaryFlex.textContent = isFlexible ? 'Flexible (backloading)' : 'Fixed date';
        }

        const heroFlex = document.getElementById('heroFlex');
        if (heroFlex) {
            heroFlex.textContent = isFlexible ? 'Flexible window' : 'Fixed schedule';
        }

        if (this.quoteData) {
            this.quoteData.flexibleSchedule = isFlexible;
        }
    }

    restoreFlexibleState() {
        const checkbox = document.getElementById('flexibleSchedule');
        if (!checkbox) return;

        const saved = Boolean(this.quoteData?.flexibleSchedule);
        checkbox.checked = saved;
        this.updateFlexibleSummary();
    }

    buildFullAddress(type) {
        const prefix = type === 'origin' ? 'origin' : 'dest';
        return `${document.getElementById(`${prefix}Address`).value}, ${document.getElementById(`${prefix}Suburb`).value} ${document.getElementById(`${prefix}State`).value} ${document.getElementById(`${prefix}Postcode`).value}, Australia`;
    }

    handleContinue() {
        if (!this.formValid) {
            alert('Please complete all required fields and calculate route before continuing.');
            return;
        }

        // Collect and merge all data
        const locationData = this.collectFormData();
        const completeQuoteData = {
            ...this.quoteData,
            ...locationData,
            step: 3,
            updatedAt: new Date().toISOString()
        };

        // Save to localStorage
        localStorage.setItem('samRemovals_quoteData', JSON.stringify(completeQuoteData));

        // Navigate to next step
        console.log('Moving to friction factors page...');
        console.log('Complete data:', completeQuoteData);

        // Navigate to friction factors page
        window.location.href = 'quote-friction.html';
    }
}

// Wait for both DOM and Google Maps API to be ready
function initializeLocationCalculator() {
    window.locationCalculator = new LocationCalculator();
}

// Check if Google Maps is already loaded
function waitForGoogleMaps() {
    if (typeof google !== 'undefined' &&
        google.maps &&
        google.maps.DistanceMatrixService &&
        google.maps.places &&
        google.maps.places.Autocomplete) {
        console.log('✅ Google Maps API loaded successfully');
        console.log('   ✓ Distance Matrix Service available');
        console.log('   ✓ Places API (Autocomplete) available');
        console.log('   ✓ Directions Service available');
        initializeLocationCalculator();
    } else {
        console.log('⏳ Waiting for Google Maps API to load...');
        // Wait for Google Maps to load
        setTimeout(waitForGoogleMaps, 100);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    waitForGoogleMaps();
});
