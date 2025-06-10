classdef (ConstructOnLoad) ModelChangedEventData < event.EventData
   properties
      UpdatedObject
      PropertyName
   end
   
   methods
      function data = ModelChangedEventData(updatedObject, propertyName)
         data.UpdatedObject = updatedObject;
         data.PropertyName = propertyName;
      end
   end
end

