public class ObsResolver {

    public static List<UIComponent> findComponentsObservingEvent(UIComponent root, String eventName) {
        List<UIComponent> result = new ArrayList<>();
        find(root, eventName, result);
        return result;
    }

    private static void find(UIComponent comp, String eventName, List<UIComponent> result) {
        // Überprüfe Tag Handler Attachments
        for (AttachedObjectHandler handler : comp.getAttachedObjectHandlers()) {
            if (handler instanceof org.primefaces.taghandler.AutoUpdateTagHandler auto) {
                if (auto.getOn() != null && auto.getOn().contains(eventName)) {
                    result.add(comp);
                }
            }
        }

        // Kinder durchsuchen
        for (UIComponent child : comp.getChildren()) {
            find(child, eventName, result);
        }

        // Facets durchsuchen
        for (UIComponent facet : comp.getFacets().values()) {
            find(facet, eventName, result);
        }
    }
}
