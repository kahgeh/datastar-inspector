/**
 * Datastar Signal Inspector
 * A development tool for monitoring and debugging Datastar signals in real-time
 * 
 * Usage:
 * 1. Include Datastar from CDN in your HTML
 * 2. Add this script after Datastar
 * 3. Call DatastarInspector.init() to start monitoring
 */

(function(window) {
    'use strict';

    const DatastarInspector = {
        // Configuration
        config: {
            position: 'right', // 'right', 'left', 'bottom'
            width: '400px',
            height: '100vh',
            theme: 'dark', // 'dark', 'light'
            startMinimized: false,
            hotkey: 'Alt+Shift+D' // Hotkey to toggle inspector
        },

        // Internal state
        signals: new Map(),
        changeLog: [],
        rootSignals: null,
        isInitialized: false,
        isVisible: true,
        container: null,
        expandedSignals: new Set(), // Track which signals are expanded

        // Initialize the inspector
        init(options = {}) {
            if (this.isInitialized) {
                console.warn('Datastar Inspector is already initialized');
                return;
            }

            // Load saved position from localStorage
            const savedPosition = localStorage.getItem('datastar-inspector-position');
            if (savedPosition && ['right', 'left', 'bottom'].includes(savedPosition)) {
                options.position = savedPosition;
            }

            // Merge options with default config
            Object.assign(this.config, options);

            // Wait for Datastar to be available
            if (typeof Datastar === 'undefined' || !Datastar.load) {
                console.error('Datastar not found. Make sure Datastar is loaded before initializing the inspector.');
                console.log('Looking for Datastar at window.Datastar');
                
                // Try to find Datastar in different possible locations
                const checkForDatastar = setInterval(() => {
                    if (window.Datastar && window.Datastar.load) {
                        clearInterval(checkForDatastar);
                        this.initializeInspector();
                    }
                }, 100);
                
                // Give up after 5 seconds
                setTimeout(() => {
                    clearInterval(checkForDatastar);
                    if (!this.isInitialized) {
                        console.error('Failed to find Datastar after 5 seconds');
                    }
                }, 5000);
            } else {
                this.initializeInspector();
            }
        },

        initializeInspector() {
            // Create plugin to expose signals
            Datastar.load({
                type: 'watcher',
                name: 'datastarInspector',
                onGlobalInit: (ctx) => {
                    this.rootSignals = ctx.root;
                    console.log('📊 Datastar Inspector: Signals exposed');
                    
                    // Initial scan
                    setTimeout(() => this.scanSignals(), 100);
                }
            });

            // Listen for signal changes
            document.addEventListener('datastar-signal-patch', (event) => {
                this.handleSignalPatch(event.detail);
            });

            // Create UI
            this.createUI();
            
            // Set up hotkey
            this.setupHotkey();

            // Periodic scan for any missed changes
            setInterval(() => this.scanSignals(), 2000);

            this.isInitialized = true;
            console.log('📊 Datastar Inspector initialized. Press ' + this.config.hotkey + ' to toggle.');
        },

        setupHotkey() {
            document.addEventListener('keydown', (e) => {
                const keys = this.config.hotkey.split('+').map(k => k.trim().toLowerCase());
                const pressed = [];
                
                if (e.altKey) pressed.push('alt');
                if (e.ctrlKey) pressed.push('ctrl');
                if (e.shiftKey) pressed.push('shift');
                if (e.metaKey) pressed.push('meta');
                pressed.push(e.key.toLowerCase());

                const match = keys.every(key => pressed.includes(key));
                if (match) {
                    e.preventDefault();
                    this.toggle();
                }
            });
        },

        createUI() {
            // Create styles
            const style = document.createElement('style');
            style.textContent = this.getStyles();
            document.head.appendChild(style);

            // Create container
            this.container = document.createElement('div');
            this.container.id = 'datastar-inspector';
            this.container.className = `dsi-container dsi-${this.config.position} dsi-${this.config.theme}`;
            if (this.config.startMinimized) {
                this.container.classList.add('dsi-minimized');
                this.isVisible = false;
            } else {
                this.adjustPageLayout(this.config.position, true);
            }

            this.container.innerHTML = `
                <div class="dsi-header">
                    <div class="dsi-title">
                        <span class="dsi-icon">📊</span>
                        <span>Datastar Inspector</span>
                        <span class="dsi-count" id="dsi-signal-count">0 signals</span>
                    </div>
                    <div class="dsi-controls">
                        <select class="dsi-position-selector" onchange="DatastarInspector.changePosition(this.value)" title="Change Position">
                            <option value="right" ${this.config.position === 'right' ? 'selected' : ''}>→</option>
                            <option value="left" ${this.config.position === 'left' ? 'selected' : ''}>←</option>
                            <option value="bottom" ${this.config.position === 'bottom' ? 'selected' : ''}>↓</option>
                        </select>
                        <button class="dsi-btn" onclick="DatastarInspector.clearLog()" title="Clear Log">🗑️</button>
                        <button class="dsi-btn" onclick="DatastarInspector.exportSignals()" title="Export Signals">💾</button>
                        <button class="dsi-btn" onclick="DatastarInspector.minimize()" title="Minimize">_</button>
                        <button class="dsi-btn" onclick="DatastarInspector.close()" title="Close">✕</button>
                    </div>
                </div>
                <div class="dsi-body">
                    <div class="dsi-tabs">
                        <button class="dsi-tab dsi-tab-active" onclick="DatastarInspector.showTab('signals')">Signals</button>
                        <button class="dsi-tab" onclick="DatastarInspector.showTab('changes')">Changes</button>
                        <button class="dsi-tab" onclick="DatastarInspector.showTab('console')">Console</button>
                    </div>
                    <div class="dsi-content">
                        <div class="dsi-panel dsi-panel-signals dsi-panel-active" id="dsi-signals">
                            <div class="dsi-search">
                                <input type="text" placeholder="Search signals..." oninput="DatastarInspector.filterSignals(this.value)">
                            </div>
                            <div class="dsi-signal-list" id="dsi-signal-list"></div>
                        </div>
                        <div class="dsi-panel dsi-panel-changes" id="dsi-changes">
                            <div class="dsi-change-log" id="dsi-change-log"></div>
                        </div>
                        <div class="dsi-panel dsi-panel-console" id="dsi-console">
                            <div class="dsi-console-input">
                                <input type="text" placeholder="Enter expression (e.g., $signals.count())" onkeypress="if(event.key==='Enter') DatastarInspector.executeCommand(this)">
                            </div>
                            <div class="dsi-console-output" id="dsi-console-output"></div>
                        </div>
                    </div>
                </div>
                <div class="dsi-status">
                    <span id="dsi-status-text">Ready</span>
                    <span id="dsi-last-update">Never updated</span>
                </div>
            `;

            document.body.appendChild(this.container);
        },

        getStyles() {
            return `
                body.dsi-push-right {
                    margin-right: 400px !important;
                    transition: margin-right 0.3s ease;
                }
                
                body.dsi-push-left {
                    margin-left: 400px !important;
                    transition: margin-left 0.3s ease;
                }
                
                body.dsi-push-bottom {
                    margin-bottom: 400px !important;
                    transition: margin-bottom 0.3s ease;
                }
                
                .dsi-container {
                    position: fixed;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
                    font-size: 12px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s ease;
                    max-height: 100vh;
                    overflow: hidden;
                }
                
                .dsi-container.dsi-right {
                    right: 0;
                    top: 0;
                    width: 400px;
                    height: 100vh;
                    border-left: 1px solid #3e3e3e;
                }
                
                .dsi-container.dsi-left {
                    left: 0;
                    top: 0;
                    width: 400px;
                    height: 100vh;
                    border-right: 1px solid #3e3e3e;
                }
                
                .dsi-container.dsi-bottom {
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 400px;
                    max-height: 50vh;
                    border-top: 1px solid #3e3e3e;
                }
                
                .dsi-container.dsi-minimized {
                    transform: translateX(100%);
                }
                
                .dsi-container.dsi-left.dsi-minimized {
                    transform: translateX(-100%);
                }
                
                .dsi-container.dsi-bottom.dsi-minimized {
                    transform: translateY(100%);
                }
                
                /* Dark theme */
                .dsi-dark {
                    background: #1e1e1e;
                    color: #d4d4d4;
                }
                
                .dsi-dark .dsi-header {
                    background: #2d2d30;
                    border-bottom: 1px solid #3e3e3e;
                }
                
                .dsi-dark .dsi-signal-item {
                    background: #252526;
                    border: 1px solid #3e3e3e;
                }
                
                .dsi-dark .dsi-signal-item:hover {
                    background: #2d2d30;
                }
                
                .dsi-dark input {
                    background: #3c3c3c;
                    border: 1px solid #3e3e3e;
                    color: #d4d4d4;
                }
                
                /* Light theme */
                .dsi-light {
                    background: #ffffff;
                    color: #333333;
                }
                
                .dsi-light .dsi-header {
                    background: #f3f3f3;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .dsi-light .dsi-signal-item {
                    background: #f9f9f9;
                    border: 1px solid #e0e0e0;
                }
                
                .dsi-light .dsi-signal-item:hover {
                    background: #f0f0f0;
                }
                
                .dsi-light input {
                    background: #ffffff;
                    border: 1px solid #e0e0e0;
                    color: #333333;
                }
                
                /* Common styles */
                .dsi-header {
                    padding: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                }
                
                .dsi-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                }
                
                .dsi-icon {
                    font-size: 16px;
                }
                
                .dsi-count {
                    background: #007acc;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                }
                
                .dsi-controls {
                    display: flex;
                    gap: 5px;
                }
                
                .dsi-btn {
                    background: transparent;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 14px;
                }
                
                .dsi-btn:hover {
                    background: rgba(127, 127, 127, 0.2);
                }
                
                .dsi-position-selector {
                    background: transparent;
                    border: 1px solid rgba(127, 127, 127, 0.3);
                    color: inherit;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 3px;
                    font-size: 14px;
                    margin-right: 5px;
                }
                
                .dsi-position-selector:hover {
                    background: rgba(127, 127, 127, 0.2);
                }
                
                .dsi-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .dsi-tabs {
                    display: flex;
                    border-bottom: 1px solid #3e3e3e;
                }
                
                .dsi-tab {
                    flex: 1;
                    padding: 8px;
                    background: transparent;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                }
                
                .dsi-tab:hover {
                    background: rgba(127, 127, 127, 0.1);
                }
                
                .dsi-tab-active {
                    border-bottom-color: #007acc;
                }
                
                .dsi-content {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                
                .dsi-panel {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: none;
                    flex-direction: column;
                }
                
                .dsi-panel-active {
                    display: flex;
                }
                
                .dsi-search {
                    padding: 10px;
                }
                
                .dsi-search input {
                    width: 100%;
                    padding: 6px;
                    border-radius: 3px;
                }
                
                .dsi-signal-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .dsi-signal-item {
                    margin-bottom: 8px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                
                .dsi-signal-item.changed {
                    animation: highlight 0.5s;
                }
                
                @keyframes highlight {
                    0% { background: #4ec9b0 !important; }
                    100% { background: inherit; }
                }
                
                .dsi-signal-header {
                    padding: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                }
                
                .dsi-signal-path {
                    font-family: 'Cascadia Code', 'Courier New', monospace;
                    color: #9cdcfe;
                    font-weight: 500;
                }
                
                .dsi-signal-value {
                    font-family: 'Cascadia Code', 'Courier New', monospace;
                    color: #ce9178;
                }
                
                .dsi-signal-value.null { color: #569cd6; }
                .dsi-signal-value.boolean { color: #569cd6; }
                .dsi-signal-value.number { color: #b5cea8; }
                .dsi-signal-value.object { color: #4ec9b0; }
                
                .dsi-signal-details {
                    padding: 0 8px 8px;
                    display: none;
                    border-top: 1px solid #3e3e3e;
                    font-size: 11px;
                }
                
                .dsi-signal-item.expanded .dsi-signal-details {
                    display: block;
                }
                
                .dsi-change-log {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .dsi-change-entry {
                    margin-bottom: 5px;
                    padding: 5px;
                    background: rgba(127, 127, 127, 0.1);
                    border-radius: 3px;
                }
                
                .dsi-timestamp {
                    color: #858585;
                    margin-right: 10px;
                }
                
                .dsi-console-input {
                    padding: 10px;
                    border-bottom: 1px solid #3e3e3e;
                }
                
                .dsi-console-input input {
                    width: 100%;
                    padding: 6px;
                    border-radius: 3px;
                    font-family: 'Cascadia Code', 'Courier New', monospace;
                }
                
                .dsi-console-output {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    font-family: 'Cascadia Code', 'Courier New', monospace;
                }
                
                .dsi-console-line {
                    margin-bottom: 5px;
                    padding: 3px;
                }
                
                .dsi-console-result { color: #4ec9b0; }
                .dsi-console-error { color: #f48771; }
                
                .dsi-status {
                    padding: 8px 10px;
                    background: #007acc;
                    color: white;
                    font-size: 11px;
                    display: flex;
                    justify-content: space-between;
                }
            `;
        },

        handleSignalPatch(patch) {
            const timestamp = new Date().toLocaleTimeString();
            
            // Store currently expanded items before update
            const wasExpanded = new Set();
            document.querySelectorAll('.dsi-signal-item.expanded').forEach(item => {
                const itemPath = item.getAttribute('data-signal-path');
                if (itemPath) wasExpanded.add(itemPath);
            });
            
            for (const [path, value] of Object.entries(patch)) {
                const oldValue = this.signals.get(path);
                this.signals.set(path, value);
                
                // Log the change
                this.changeLog.unshift({
                    timestamp,
                    path,
                    oldValue,
                    newValue: value
                });
                
                // Keep only last 100 changes
                if (this.changeLog.length > 100) {
                    this.changeLog.pop();
                }
            }
            
            // Merge the wasExpanded into expandedSignals to preserve state
            wasExpanded.forEach(path => this.expandedSignals.add(path));
            
            this.updateUI();
            
            // After updating UI, highlight changed items
            for (const [path, value] of Object.entries(patch)) {
                const element = document.querySelector(`[data-signal-path="${path}"]`);
                if (element) {
                    element.classList.remove('changed');
                    void element.offsetWidth; // Force reflow
                    element.classList.add('changed');
                }
            }
        },

        scanSignals() {
            if (!this.rootSignals) return;
            
            // Store old signals to detect changes
            const oldSignals = new Map(this.signals);
            
            this.signals.clear();
            this.traverseObject(this.rootSignals, '');
            
            // Only update UI if signals actually changed
            let hasChanges = oldSignals.size !== this.signals.size;
            if (!hasChanges) {
                for (const [key, value] of this.signals) {
                    const oldValue = oldSignals.get(key);
                    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
                        hasChanges = true;
                        break;
                    }
                }
            }
            
            if (hasChanges) {
                this.updateUI();
            }
        },

        traverseObject(obj, prefix) {
            for (const key in obj) {
                const path = prefix ? `${prefix}.${key}` : key;
                try {
                    // Try to get the value (might be a signal function)
                    const value = typeof obj[key] === 'function' ? obj[key]() : obj[key];
                    
                    if (value !== undefined) {
                        this.signals.set(path, value);
                        
                        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                            this.traverseObject(value, path);
                        }
                    }
                } catch (e) {
                    // Might be a computed signal that needs dependencies
                    this.signals.set(path, '<computed>');
                }
            }
        },

        getValueType(value) {
            if (value === null) return 'null';
            if (value === undefined) return 'null';
            if (typeof value === 'boolean') return 'boolean';
            if (typeof value === 'number') return 'number';
            if (typeof value === 'object') return 'object';
            return 'string';
        },

        formatValue(value) {
            if (value === null) return 'null';
            if (value === undefined) return 'undefined';
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value, null, 2);
                } catch {
                    return '[Object]';
                }
            }
            return String(value);
        },

        updateUI() {
            if (!this.container) return;
            
            // Update signal count
            document.getElementById('dsi-signal-count').textContent = `${this.signals.size} signals`;
            
            // Update last update time
            document.getElementById('dsi-last-update').textContent = new Date().toLocaleTimeString();
            
            // Update signal list
            this.updateSignalList();
            
            // Update change log
            this.updateChangeLog();
        },

        updateSignalList() {
            const container = document.getElementById('dsi-signal-list');
            if (!container) return;
            
            const filter = container.parentElement.querySelector('input')?.value.toLowerCase() || '';
            
            // Store currently expanded items from DOM before rebuilding
            document.querySelectorAll('.dsi-signal-item.expanded').forEach(item => {
                const itemPath = item.getAttribute('data-signal-path');
                if (itemPath) {
                    this.expandedSignals.add(itemPath);
                }
            });
            
            let html = '';
            const sortedSignals = Array.from(this.signals.entries()).sort((a, b) => 
                a[0].localeCompare(b[0])
            );
            
            sortedSignals.forEach(([path, value]) => {
                if (filter && !path.toLowerCase().includes(filter)) return;
                
                const valueType = this.getValueType(value);
                const formattedValue = this.formatValue(value);
                const displayValue = formattedValue.length > 50 
                    ? formattedValue.substring(0, 50) + '...' 
                    : formattedValue;
                
                const isExpanded = this.expandedSignals.has(path);
                html += `
                    <div class="dsi-signal-item ${isExpanded ? 'expanded' : ''}" data-signal-path="${path}">
                        <div class="dsi-signal-header" onclick="DatastarInspector.toggleSignalByElement(this)">
                            <span class="dsi-signal-path">${path}</span>
                            <span class="dsi-signal-value ${valueType}">${displayValue}</span>
                        </div>
                        <div class="dsi-signal-details">
                            <div>Type: ${valueType}</div>
                            <div>Value: <pre>${formattedValue}</pre></div>
                            <button onclick="DatastarInspector.copyPathByElement(this)">Copy Path</button>
                            <button onclick="DatastarInspector.copyValueByElement(this)">Copy Value</button>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html || '<div style="padding: 20px; text-align: center; opacity: 0.5;">No signals found</div>';
        },

        updateChangeLog() {
            const container = document.getElementById('dsi-change-log');
            if (!container) return;
            
            let html = '';
            this.changeLog.slice(0, 50).forEach(entry => {
                html += `
                    <div class="dsi-change-entry">
                        <span class="dsi-timestamp">${entry.timestamp}</span>
                        <span class="dsi-signal-path">${entry.path}</span>: 
                        ${this.formatValue(entry.oldValue)} → ${this.formatValue(entry.newValue)}
                    </div>
                `;
            });
            
            container.innerHTML = html || '<div style="padding: 20px; text-align: center; opacity: 0.5;">No changes yet</div>';
        },

        toggleSignal(header, path) {
            const signalItem = header.parentElement;
            const isExpanded = signalItem.classList.contains('expanded');
            
            // Simple toggle - each signal independently opens/closes
            if (isExpanded) {
                signalItem.classList.remove('expanded');
                this.expandedSignals.delete(path);
            } else {
                signalItem.classList.add('expanded');
                this.expandedSignals.add(path);
            }
        },
        
        toggleSignalByElement(header) {
            const signalItem = header.parentElement;
            const path = signalItem.getAttribute('data-signal-path');
            const isExpanded = signalItem.classList.contains('expanded');
            
            // Simple toggle - each signal independently opens/closes
            if (isExpanded) {
                signalItem.classList.remove('expanded');
                this.expandedSignals.delete(path);
            } else {
                signalItem.classList.add('expanded');
                this.expandedSignals.add(path);
            }
        },
        
        copyPathByElement(button) {
            const signalItem = button.closest('.dsi-signal-item');
            const path = signalItem.getAttribute('data-signal-path');
            this.copyPath(path);
        },
        
        copyValueByElement(button) {
            const signalItem = button.closest('.dsi-signal-item');
            const path = signalItem.getAttribute('data-signal-path');
            this.copyValue(path);
        },

        showTab(tabName) {
            // Update tabs
            document.querySelectorAll('.dsi-tab').forEach(tab => {
                tab.classList.remove('dsi-tab-active');
            });
            event.target.classList.add('dsi-tab-active');
            
            // Update panels
            document.querySelectorAll('.dsi-panel').forEach(panel => {
                panel.classList.remove('dsi-panel-active');
            });
            document.getElementById(`dsi-${tabName}`).classList.add('dsi-panel-active');
        },

        filterSignals(value) {
            this.updateSignalList();
        },

        executeCommand(input) {
            const command = input.value;
            if (!command) return;
            
            const output = document.getElementById('dsi-console-output');
            
            try {
                // Replace $signals with the actual root
                const modifiedCommand = command.replace(/\$signals/g, 'DatastarInspector.rootSignals');
                const result = eval(modifiedCommand);
                
                output.innerHTML += `
                    <div class="dsi-console-line">
                        <span>&gt; ${command}</span>
                    </div>
                    <div class="dsi-console-line dsi-console-result">
                        ${this.formatValue(result)}
                    </div>
                `;
            } catch (error) {
                output.innerHTML += `
                    <div class="dsi-console-line">
                        <span>&gt; ${command}</span>
                    </div>
                    <div class="dsi-console-line dsi-console-error">
                        Error: ${error.message}
                    </div>
                `;
            }
            
            input.value = '';
            output.scrollTop = output.scrollHeight;
        },

        copyPath(path) {
            navigator.clipboard.writeText(`$signals.${path}`);
            this.showStatus('Path copied to clipboard');
        },

        copyValue(path) {
            const value = this.signals.get(path);
            navigator.clipboard.writeText(this.formatValue(value));
            this.showStatus('Value copied to clipboard');
        },

        exportSignals() {
            const data = {};
            this.signals.forEach((value, key) => {
                data[key] = value;
            });
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `datastar-signals-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showStatus('Signals exported');
        },

        clearLog() {
            this.changeLog = [];
            this.updateChangeLog();
            this.showStatus('Change log cleared');
        },

        showStatus(message) {
            const status = document.getElementById('dsi-status-text');
            if (status) {
                status.textContent = message;
                setTimeout(() => {
                    status.textContent = 'Ready';
                }, 2000);
            }
        },

        minimize() {
            this.container.classList.add('dsi-minimized');
            this.isVisible = false;
            this.adjustPageLayout(this.config.position, false);
        },

        close() {
            this.container.style.display = 'none';
            this.adjustPageLayout(this.config.position, false);
        },

        toggle() {
            if (this.container.style.display === 'none') {
                this.container.style.display = '';
                this.isVisible = true;
                this.adjustPageLayout(this.config.position, true);
            } else if (this.isVisible) {
                this.minimize();
            } else {
                this.container.classList.remove('dsi-minimized');
                this.isVisible = true;
                this.adjustPageLayout(this.config.position, true);
            }
        },
        
        changePosition(position) {
            if (!this.container) return;
            
            // Remove old page adjustment
            if (this.isVisible) {
                this.adjustPageLayout(this.config.position, false);
            }
            
            // Remove all position classes
            this.container.classList.remove('dsi-right', 'dsi-left', 'dsi-bottom');
            
            // Add new position class
            this.container.classList.add(`dsi-${position}`);
            
            // Update config
            this.config.position = position;
            
            // Apply new page adjustment
            if (this.isVisible) {
                this.adjustPageLayout(position, true);
            }
            
            // Save to localStorage
            localStorage.setItem('datastar-inspector-position', position);
        },
        
        adjustPageLayout(position, add) {
            const body = document.body;
            const classes = ['dsi-push-right', 'dsi-push-left', 'dsi-push-bottom'];
            
            // Remove all push classes
            classes.forEach(cls => body.classList.remove(cls));
            
            // Add the appropriate push class if needed
            if (add && !this.container.classList.contains('dsi-minimized')) {
                body.classList.add(`dsi-push-${position}`);
            }
        },

        // Public API for accessing signals
        getSignal(path) {
            if (!this.rootSignals) return undefined;
            
            const parts = path.split('.');
            let current = this.rootSignals;
            
            for (const part of parts) {
                if (!current || !current[part]) return undefined;
                current = current[part];
            }
            
            return typeof current === 'function' ? current() : current;
        },

        setSignal(path, value) {
            if (!this.rootSignals) return false;
            
            const parts = path.split('.');
            const lastPart = parts.pop();
            let current = this.rootSignals;
            
            for (const part of parts) {
                if (!current[part]) return false;
                current = current[part];
            }
            
            if (typeof current[lastPart] === 'function') {
                return current[lastPart](value);
            }
            return false;
        }
    };

    // Expose to window
    window.DatastarInspector = DatastarInspector;

})(window);