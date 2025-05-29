import { BaseComponent } from './BaseComponent.js';

/**
 * LogConsole component for displaying log messages
 */
export class LogConsole extends BaseComponent {
    /**
     * Create a new LogConsole instance
     * @param {Object} view - The parent view instance
     */
    constructor(view) {
        super(view);
        this.logs = [];
        this.createLogConsole();
        
        // Store component reference on element for layout access
        this.element.__component = this;
    }

    /**
     * Create the log console DOM structure
     */
    createLogConsole() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'log-console';

        // Create header
        const header = document.createElement('div');
        header.className = 'log-header';

        const title = document.createElement('h3');
        title.textContent = 'Console';

        const clearButton = document.createElement('button');
        clearButton.className = 'log-clear-button';
        clearButton.textContent = 'Clear';
        clearButton.addEventListener('click', () => this.clear());

        header.appendChild(title);
        header.appendChild(clearButton);

        // Create log content container
        this.logContent = document.createElement('div');
        this.logContent.className = 'log-content';

        // Assemble the component
        this.element.appendChild(header);
        this.element.appendChild(this.logContent);
    }

    /**
     * Add a log entry to the console
     * @param {string} message - The log message
     * @param {string} [level='info'] - Log level (info, warn, error, debug)
     */
    log(message, level = 'info') {
        // Create log entry
        const entry = {
            message,
            level,
            timestamp: new Date()
        };

        // Add to logs array
        this.logs.push(entry);

        // Create DOM element
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;

        // Add timestamp
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = this.formatTime(entry.timestamp);
        logEntry.appendChild(timeSpan);

        // Add level indicator
        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-level';
        levelSpan.textContent = level.toUpperCase();
        logEntry.appendChild(levelSpan);

        // Add message
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;
        logEntry.appendChild(messageSpan);

        // Add to log content
        this.logContent.appendChild(logEntry);

        // Scroll to bottom
        this.logContent.scrollTop = this.logContent.scrollHeight;
    }

    /**
     * Format a timestamp for display
     * @param {Date} date - The date to format
     * @returns {string} - Formatted time string
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /**
     * Clear all log entries
     */
    clear() {
        this.logs = [];
        this.logContent.innerHTML = '';
        this.log('Console cleared', 'info');
    }

    /**
     * Update the log console based on model changes
     * @param {Object} model - The model data
     */
    updateModel(model) {
        // Log console doesn't need to update based on model changes
    }
}