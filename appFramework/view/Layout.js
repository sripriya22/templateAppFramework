/**
 * Layout class for managing a 5-panel layout system with resizable and collapsible panels.
 * The layout consists of a header, main panel, bottom panel, and two side panels (left and right).
 */
export class Layout {
    /**
     * Create a new Layout instance
     * @param {HTMLElement} container - The container element to append the layout to
     */
    constructor(container) {
        this.container = container;
        this.createLayout();
        this.setupResizing();
        this.setupCollapsing();
    }

    /**
     * Create the layout DOM structure
     */
    createLayout() {
        // Create main container
        this.element = document.createElement('div');
        this.element.className = 'layout-container';

        // Create header
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'layout-header';
        this.headerElement.style.display = 'none'; // Hide by default

        // Create content container (holds main content and side panels)
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'layout-content';

        // Create left panel
        this.leftElement = document.createElement('div');
        this.leftElement.className = 'layout-left';
        this.leftElement.style.display = 'none'; // Hide by default
        this.leftToggle = this.createToggleButton(this.leftElement, 'left');
        this.leftElement.appendChild(this.leftToggle);
        
        // Create left panel content container
        this.leftContent = document.createElement('div');
        this.leftContent.className = 'panel-content';
        this.leftElement.appendChild(this.leftContent);
        
        // Create left panel collapsed content
        this.leftCollapsed = document.createElement('div');
        this.leftCollapsed.className = 'collapsed-content';
        this.leftCollapsed.textContent = 'Model Inspector';
        this.leftElement.appendChild(this.leftCollapsed);

        // Create main panel
        this.mainElement = document.createElement('div');
        this.mainElement.className = 'layout-main';
        // Main panel is always shown as it's the primary content area
        
        // Create main panel content container
        this.mainContent = document.createElement('div');
        this.mainContent.className = 'panel-content';
        this.mainElement.appendChild(this.mainContent);

        // Create right panel
        this.rightElement = document.createElement('div');
        this.rightElement.className = 'layout-right';
        this.rightElement.style.display = 'none'; // Hide by default
        this.rightToggle = this.createToggleButton(this.rightElement, 'right');
        this.rightElement.appendChild(this.rightToggle);
        
        // Create right panel content container
        this.rightContent = document.createElement('div');
        this.rightContent.className = 'panel-content';
        this.rightElement.appendChild(this.rightContent);
        
        // Create right panel collapsed content
        this.rightCollapsed = document.createElement('div');
        this.rightCollapsed.className = 'collapsed-content';
        this.rightCollapsed.textContent = 'JSON Viewer';
        this.rightElement.appendChild(this.rightCollapsed);

        // Create bottom panel
        this.bottomElement = document.createElement('div');
        this.bottomElement.className = 'layout-bottom';
        this.bottomElement.style.display = 'none'; // Hide by default
        this.bottomToggle = this.createToggleButton(this.bottomElement, 'bottom');
        this.bottomElement.appendChild(this.bottomToggle);
        
        // Create bottom panel content container
        this.bottomContent = document.createElement('div');
        this.bottomContent.className = 'panel-content';
        this.bottomElement.appendChild(this.bottomContent);
        
        // Create bottom panel collapsed content
        this.bottomCollapsed = document.createElement('div');
        this.bottomCollapsed.className = 'collapsed-content';
        this.bottomCollapsed.textContent = 'Console';
        this.bottomElement.appendChild(this.bottomCollapsed);

        // Assemble the layout
        this.contentElement.appendChild(this.leftElement);
        this.contentElement.appendChild(this.mainElement);
        this.contentElement.appendChild(this.rightElement);

        this.element.appendChild(this.headerElement);
        this.element.appendChild(this.contentElement);
        this.element.appendChild(this.bottomElement);

        // Append to container if provided
        if (this.container) {
            this.container.appendChild(this.element);
        }
    }

    /**
     * Create a toggle button for collapsing/expanding panels
     * @param {HTMLElement} panel - The panel to toggle
     * @param {string} position - The position of the panel (left, right, bottom)
     * @returns {HTMLElement} - The toggle button element
     */
    createToggleButton(panel, position) {
        const button = document.createElement('button');
        button.className = 'panel-toggle';
        button.innerHTML = position === 'bottom' ? '▲' : (position === 'left' ? '◀' : '▶');
        button.style.top = position === 'bottom' ? '5px' : '5px';
        button.style.right = position === 'left' ? '5px' : '5px';
        button.style.left = position === 'right' ? '5px' : 'auto';
        
        button.addEventListener('click', () => {
            const isCollapsed = panel.classList.toggle('collapsed');
            button.innerHTML = position === 'bottom' 
                ? (isCollapsed ? '▼' : '▲') 
                : (position === 'left' 
                    ? (isCollapsed ? '▶' : '◀') 
                    : (isCollapsed ? '◀' : '▶'));
        });
        
        return button;
    }

    /**
     * Setup resizing functionality for panels
     */
    setupResizing() {
        // Left panel resize handle
        const leftResizeHandle = document.createElement('div');
        leftResizeHandle.className = 'resize-handle vertical';
        leftResizeHandle.style.right = '0';
        leftResizeHandle.style.top = '0';
        this.leftElement.appendChild(leftResizeHandle);

        // Right panel resize handle
        const rightResizeHandle = document.createElement('div');
        rightResizeHandle.className = 'resize-handle vertical';
        rightResizeHandle.style.left = '0';
        rightResizeHandle.style.top = '0';
        this.rightElement.appendChild(rightResizeHandle);

        // Bottom panel resize handle
        const bottomResizeHandle = document.createElement('div');
        bottomResizeHandle.className = 'resize-handle horizontal';
        bottomResizeHandle.style.top = '0';
        bottomResizeHandle.style.left = '0';
        this.bottomElement.appendChild(bottomResizeHandle);

        // Setup resize event handlers
        this.setupResizeHandler(leftResizeHandle, 'left');
        this.setupResizeHandler(rightResizeHandle, 'right');
        this.setupResizeHandler(bottomResizeHandle, 'bottom');
    }

    /**
     * Setup resize event handler for a specific panel
     * @param {HTMLElement} handle - The resize handle element
     * @param {string} panelType - The type of panel (left, right, bottom)
     */
    setupResizeHandler(handle, panelType) {
        let startX, startY, startWidth, startHeight;
        const panel = panelType === 'left' ? this.leftElement : 
                     (panelType === 'right' ? this.rightElement : this.bottomElement);

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(panel).width, 10);
            startHeight = parseInt(getComputedStyle(panel).height, 10);
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        });

        const resize = (e) => {
            if (panelType === 'bottom') {
                panel.style.height = (startHeight - (e.clientY - startY)) + 'px';
            } else if (panelType === 'left') {
                panel.style.width = (startWidth + (e.clientX - startX)) + 'px';
            } else if (panelType === 'right') {
                panel.style.width = (startWidth - (e.clientX - startX)) + 'px';
            }
        };

        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        };
    }

    /**
     * Setup collapsing functionality for panels
     */
    setupCollapsing() {
        // This is handled by the toggle buttons created in createToggleButton
    }

    /**
     * Set the content for the header panel
     * @param {HTMLElement} element - The element to set as header content
     */
    setHeader(element) {
        this.headerElement.innerHTML = '';
        
        if (element) {
            // Show panel and add content
            this.headerElement.style.display = 'block';
            this.headerElement.appendChild(element);
        } else {
            // Hide panel completely if no content
            this.headerElement.style.display = 'none';
        }
    }

    /**
     * Set the content for the main panel
     * @param {HTMLElement} element - The element to set as main content
     */
    setMain(element) {
        this.mainContent.innerHTML = '';
        
        if (element) {
            // Show panel and add content
            this.mainElement.style.display = 'flex';
            this.mainContent.appendChild(element);
        } else {
            // Hide panel completely if no content
            this.mainElement.style.display = 'none';
        }
    }

    /**
     * Set the content for the left panel
     * @param {HTMLElement} element - The element to set as left panel content
     */
    setLeft(element) {
        this.leftContent.innerHTML = '';
        
        if (element) {
            // Show panel and add content
            this.leftElement.style.display = 'flex';
            this.leftContent.appendChild(element);
        } else {
            // Hide panel completely if no content
            this.leftElement.style.display = 'none';
        }
    }

    /**
     * Set the content for the right panel
     * @param {HTMLElement} element - The element to set as right panel content
     */
    setRight(element) {
        this.rightContent.innerHTML = '';
        
        if (element) {
            // Show panel and add content
            this.rightElement.style.display = 'flex';
            this.rightContent.appendChild(element);
        } else {
            // Hide panel completely if no content
            this.rightElement.style.display = 'none';
        }
    }

    /**
     * Set the content for the bottom panel
     * @param {HTMLElement} element - The element to set as bottom panel content
     */
    setBottom(element) {
        this.bottomContent.innerHTML = '';
        
        if (element) {
            // Show panel and add content
            this.bottomElement.style.display = 'block';
            this.bottomContent.appendChild(element);
        } else {
            // Hide panel completely if no content
            this.bottomElement.style.display = 'none';
        }
    }

    /**
     * Update all panels with new model data
     * @param {Object} model - The model data to update with
     */
    updateModel(model) {
        // Find all components in the layout and update them
        this.updateComponentsInContainer(this.headerContent, model);
        this.updateComponentsInContainer(this.mainContent, model);
        this.updateComponentsInContainer(this.leftContent, model);
        this.updateComponentsInContainer(this.rightContent, model);
        this.updateComponentsInContainer(this.bottomContent, model);
    }
    
    /**
     * Update all components in a container
     * @param {HTMLElement} container - The container to look for components in
     * @param {Object} model - The model data to update with
     */
    updateComponentsInContainer(container, model) {
        if (!container) return;
        
        // Update direct children that are components
        Array.from(container.children).forEach(child => {
            if (child.__component && typeof child.__component.updateModel === 'function') {
                child.__component.updateModel(model);
            }
        });
    }
    
    /**
     * Get the header content container
     * @returns {HTMLElement} - The header content container
     */
    getHeaderContent() {
        return this.headerElement;
    }
    
    /**
     * Get the main content container
     * @returns {HTMLElement} - The main content container
     */
    getMainContent() {
        return this.mainContent;
    }
    
    /**
     * Get the left content container
     * @returns {HTMLElement} - The left content container
     */
    getLeftContent() {
        return this.leftContent;
    }
    
    /**
     * Get the right content container
     * @returns {HTMLElement} - The right content container
     */
    getRightContent() {
        return this.rightContent;
    }
    
    /**
     * Get the bottom content container
     * @returns {HTMLElement} - The bottom content container
     */
    getBottomContent() {
        return this.bottomContent;
    }
}