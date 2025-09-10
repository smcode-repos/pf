/**
 * Fügt Paging-Informationen zur CSV hinzu
 * @param {Array} csvData - CSV-Daten Array
 * @param {Object} widget - PrimeFaces DataTable Widget
 * @param {string} delimiter - CSV-Trennzeichen
 */
function addPagingInfoToCsv(csvData, widget, delimiter) {
    if (!widget || !widget.cfg || !widget.cfg.paginator) {
        return;
    }
    
    const paginator = widget.paginator;
    if (!paginator) {
        return;
    }
    
    try {
        const currentPage = paginator.getCurrentPage() + 1;
        const totalPages = paginator.getTotalPages();
        const totalRecords = paginator.getTotalRecords();
        const pageSize = paginator.getRows();
        const startRecord = (currentPage - 1) * pageSize + 1;
        const endRecord = Math.min(currentPage * pageSize, totalRecords);
        
        csvData.push(''); // Leere Zeile
        csvData.push('Paging-Info' + delimiter + startRecord + ' von ' + totalRecords + ' Datensätzen' + delimiter + 'Seite ' + currentPage + ' von ' + totalPages);
    } catch (error) {
        console.warn('Konnte Paging-Informationen nicht extrahieren:', error);
    }
}

/**
 * Exportiert PrimeFaces DataTable Daten als CSV
 * @param {string} tableIdentifier - ID oder widgetVar der DataTable
 * @param {boolean} exportAll - true: alle Daten, false: nur sichtbare Daten
 * @param {string} filename - Dateiname für den Download (optional)
 * @param {string} delimiter - CSV-Trennzeichen (default: ';')
 */
function exportDataTableToCSV(tableIdentifier, exportAll = false, filename = 'datatable_export.csv', delimiter = ';') {
    let dataTable;
    let widget;
    
    // DataTable über ID oder widgetVar finden
    if (tableIdentifier.startsWith('#') || document.getElementById(tableIdentifier.replace('#', ''))) {
        // Über ID suchen
        const tableId = tableIdentifier.replace('#', '');
        const tableElement = document.getElementById(tableId);
        
        if (!tableElement) {
            console.error('DataTable mit ID "' + tableId + '" nicht gefunden');
            return;
        }
        
        dataTable = tableElement;
        // Widget über widgetVar finden (falls vorhanden)
        widget = window[tableId.replace(':', '_')] || PF(tableId);
    } else {
        // Über widgetVar suchen
        widget = PF(tableIdentifier);
        if (widget && widget.jq) {
            dataTable = widget.jq[0];
        }
    }
    
    if (!dataTable) {
        console.error('DataTable nicht gefunden: ' + tableIdentifier);
        return;
    }
    
    let csvData = [];
    let headers = [];
    let rows = [];
    
    // Headers extrahieren (nur sichtbare Spalten, keine Checkboxes/Actions)
    const headerRow = dataTable.querySelector('thead tr');
    if (headerRow) {
        const headerCells = headerRow.querySelectorAll('th');
        headerCells.forEach(th => {
            // Nur Selection-Checkboxes und Row-Editor überspringen
            // row-toggler-column SOLL exportiert werden
            if (!th.classList.contains('ui-selection-column') && 
                !th.classList.contains('ui-roweditor-column') &&
                !th.hasAttribute('data-skip-export')) {
                
                // Header-Text extrahieren (ohne Sortier-Icons etc.)
                let headerText = '';
                const headerSpan = th.querySelector('.ui-column-title');
                if (headerSpan) {
                    headerText = headerSpan.textContent.trim();
                } else {
                    headerText = th.textContent.trim().replace(/[\n\r\s]+/g, ' ');
                }
                
                // Auch Spalten ohne Header-Text berücksichtigen
                if (!headerText || headerText === '') {
                    headerText = 'Spalte_' + (headers.length + 1);
                }
                
                headers.push(headerText);
            }
        });
    }
    
    // Datenzeilen extrahieren
    if (exportAll && widget && widget.cfg && widget.cfg.paginator) {
        // Alle Daten exportieren - über Widget-Datenquelle
        try {
            const allData = widget.data || [];
            allData.forEach(rowData => {
                const row = [];
                // Hier müssten Sie die Datenstruktur entsprechend Ihrem DataTable anpassen
                headers.forEach((header, index) => {
                    const cellValue = extractCellValueFromData(rowData, index, header);
                    row.push(escapeCsvValue(cellValue, delimiter));
                });
                rows.push(row);
            });
        } catch (e) {
            console.warn('Konnte nicht alle Daten laden, verwende sichtbare Daten:', e);
            exportAll = false;
        }
    }
    
    // Sichtbare Datenzeilen extrahieren (falls exportAll false oder als Fallback)
    if (!exportAll || rows.length === 0) {
        const bodyRows = dataTable.querySelectorAll('tbody tr');
        bodyRows.forEach(tr => {
            // Leere Zeilen und Gruppierungszeilen überspringen
            if (tr.classList.contains('ui-datatable-empty-message') ||
                tr.classList.contains('ui-rowgroup-header') ||
                tr.classList.contains('ui-rowgroup-footer')) {
                return;
            }
            
            const row = [];
            const cells = tr.querySelectorAll('td');
            let headerIndex = 0;
            
            cells.forEach(td => {
                // Nur Selection-Checkboxes und Row-Editor überspringen
                // row-toggler-column SOLL exportiert werden
                const isSpecialColumn = td.classList.contains('ui-selection-column') || 
                                      td.classList.contains('ui-roweditor-column') ||
                                      td.hasAttribute('data-skip-export');
                
                if (!isSpecialColumn && headerIndex < headers.length) {
                    const cellValue = extractCellValue(td);
                    row.push(escapeCsvValue(cellValue, delimiter));
                }
                
                // Header-Index nur für nicht-spezielle Spalten erhöhen
                if (!isSpecialColumn) {
                    headerIndex++;
                }
            });
            
            if (row.length > 0) {
                rows.push(row);
            }
        });
    }
    
    // CSV zusammensetzen
    if (headers.length > 0) {
        csvData.push(headers.join(delimiter));
    }
    
    rows.forEach(row => {
        csvData.push(row.join(delimiter));
    });
    
    // Paging-Informationen hinzufügen
    addPagingInfoToCsv(csvData, widget, delimiter);
    
    // CSV Download
    downloadCSV(csvData.join('\n'), filename);
}

/**
 * Extrahiert den Zellwert aus einem TD-Element
 */
function extractCellValue(td) {
    // Text aus Input-Feldern extrahieren
    const input = td.querySelector('input[type="text"], input[type="number"], input[type="email"], textarea');
    if (input) {
        return input.value;
    }
    
    // Text aus Select-Boxen extrahieren
    const select = td.querySelector('select');
    if (select) {
        return select.selectedOptions[0] ? select.selectedOptions[0].text : '';
    }
    
    // Checkbox-Werte
    const checkbox = td.querySelector('input[type="checkbox"]');
    if (checkbox) {
        return checkbox.checked ? 'Ja' : 'Nein';
    }
    
    // Links - hier wird "X" für <a> Tags gesetzt
    const link = td.querySelector('a');
    if (link) {
        return 'X';
    }
    
    // Normaler Text (Icons und Buttons entfernen)
    let text = td.textContent.trim();
    
    // Mehrfache Leerzeichen und Zeilenumbrüche normalisieren
    text = text.replace(/[\n\r\s]+/g, ' ').trim();
    
    return text;
}

/**
 * Extrahiert Zellwert aus Datenobjekt (für exportAll)
 */
function extractCellValueFromData(rowData, columnIndex, columnHeader) {
    // Diese Funktion müssen Sie entsprechend Ihrer Datenstruktur anpassen
    // Beispiel-Implementierung:
    if (typeof rowData === 'object') {
        // Versuche über Header-Namen zu finden
        const headerKey = columnHeader.toLowerCase().replace(/\s+/g, '');
        if (rowData[headerKey] !== undefined) {
            return rowData[headerKey];
        }
        
        // Versuche über Index
        const values = Object.values(rowData);
        if (values[columnIndex] !== undefined) {
            return values[columnIndex];
        }
    }
    
    return '';
}

/**
 * Escaped CSV-Werte für korrekte Formatierung
 */
function escapeCsvValue(value, delimiter) {
    if (value === null || value === undefined) {
        return '';
    }
    
    const stringValue = String(value);
    
    // Wenn der Wert Anführungszeichen, Zeilenumbrüche oder das Trennzeichen enthält
    if (stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r') || stringValue.includes(delimiter)) {
        // Anführungszeichen verdoppeln und gesamten Wert in Anführungszeichen setzen
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

/**
 * Startet den CSV-Download
 */
function downloadCSV(csvContent, filename) {
    // BOM für korrekte UTF-8 Darstellung in Excel hinzufügen
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Download-Link erstellen
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // URL freigeben
    URL.revokeObjectURL(url);
}

// Beispiel-Verwendung:
/*
// Export über ID, nur sichtbare Daten
exportDataTableToCSV('#myDataTable', false, 'sichtbare_daten.csv');

// Export über widgetVar, alle Daten
exportDataTableToCSV('myTableWidget', true, 'alle_daten.csv');

// Mit benutzerdefinierten Parametern
exportDataTableToCSV('myTableWidget', true, 'export.csv', ';');
*/
