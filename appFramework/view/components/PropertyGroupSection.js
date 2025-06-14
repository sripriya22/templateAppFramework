import { ModelPanelSection } from './ModelPanelSection.js';

/**
 * Component for managing property group sections in the ModelPanel
 */
export class PropertyGroupSection extends ModelPanelSection {
    /**
     * Create section element from configuration
     * @returns {HTMLElement} The created section element
     * @protected
     */
    _createSection() {
        return this._createPropertyGroup();
    }
    
    /**
     * Create a property group from configuration
     * @returns {HTMLElement} The created property group element
     * @private
     */
    _createPropertyGroup() {
        // Create group container
        const group = document.createElement('div');
        group.className = 'property-group';
        
        // Add group header if name is provided
        if (this._sectionConfig.GroupName) {
            const groupHeader = document.createElement('h3');
            groupHeader.className = 'group-header';
            groupHeader.textContent = this._sectionConfig.GroupName;
            group.appendChild(groupHeader);
        }
        
        // Create properties from configuration
        if (this._sectionConfig.Properties && Array.isArray(this._sectionConfig.Properties)) {
            // Sort properties by order if available
            const sortedProps = [...this._sectionConfig.Properties].sort((a, b) => 
                (a.Order || 0) - (b.Order || 0)
            );
            
            // Create each property field
            sortedProps.forEach(propConfig => {
                const propPath = propConfig.PropertyPath;
                if (propPath) {
                    this._modelPanel._createConfiguredField(this._model, propPath, propConfig, group);
                }
            });
        }
        
        return group;
    }
}
