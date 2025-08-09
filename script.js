document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    // --- Element References ---
    const fileInput = document.getElementById('csv-file');
    const fileNameSpan = document.getElementById('file-name');
    const unassignedList = document.getElementById('unassigned-list');
    const generateButton = document.getElementById('generate-xlsx');
    const assignedColumnsContainer = document.getElementById('assigned-columns');
    const allocationBoard = document.getElementById('allocation-board');
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    
    const loadNames = [
        'Church Bus Load 1', 'Church Bus Load 2', 'Church Bus Load 3',
        'Special Taxi Load 1', 'Special Taxi Load 2', 'Special Taxi Load 3'
    ];

    // Define the new priority column name for easy reference
    const priorityColumn = "If you're doing the membership process, are you coming to the class at 8:30 AM this Sunday?";
    
    // --- UI Initialization ---
    loadNames.forEach(name => {
        const columnId = name.toLowerCase().replace(/\s+/g, '-');
        const columnHTML = `
            <div class="column">
                <div class="column-header" style="background-color: #e0e7ff; border-bottom-color: #c7d2fe;">
                    <h3 style="color: #3730a3;">${name}</h3>
                    <p id="${columnId}-count" style="color: #4338ca;">Requests: 0</p>
                    <p id="${columnId}-people-count" style="color: #4338ca; font-weight: 500;">Total People: 0</p>
                </div>
                <div id="${columnId}" class="list-group"></div>
            </div>
        `;
        assignedColumnsContainer.innerHTML += columnHTML;
    });

    // --- Native Drag and Drop & Selection Logic ---

    // Use event delegation for all interactions
    allocationBoard.addEventListener('click', handleItemClick);
    allocationBoard.addEventListener('dragstart', handleDragStart);
    allocationBoard.addEventListener('dragend', handleDragEnd);
    allocationBoard.addEventListener('dragover', handleDragOver);
    allocationBoard.addEventListener('dragleave', handleDragLeave);
    allocationBoard.addEventListener('drop', handleDrop);

    function handleItemClick(e) {
        const clickedItem = e.target.closest('.list-group-item');
        if (!clickedItem) return;
        // A simple click now only toggles the 'selected' class.
        clickedItem.classList.toggle('selected');
    }
    
    function handleDragStart(e) {
        const draggedItem = e.target.closest('.list-group-item');
        if (!draggedItem) return;

        if (!draggedItem.classList.contains('selected')) {
            document.querySelectorAll('.list-group-item.selected').forEach(el => el.classList.remove('selected'));
            draggedItem.classList.add('selected');
        }

        const selectedItems = document.querySelectorAll('.list-group-item.selected');
        selectedItems.forEach(item => item.classList.add('dragging'));
        
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        document.querySelectorAll('.dragging').forEach(item => item.classList.remove('dragging'));
    }

    function handleDragOver(e) {
        const dropTarget = e.target.closest('.list-group');
        if (dropTarget) {
            e.preventDefault(); 
            const placeholder = document.querySelector('.placeholder');
            const afterElement = getDragAfterElement(dropTarget, e.clientY);
            if (afterElement == null) {
                dropTarget.appendChild(placeholder);
            } else {
                dropTarget.insertBefore(placeholder, afterElement);
            }
        }
    }
    
     function handleDragLeave(e) {
        const dropTarget = e.target.closest('.list-group');
        if (dropTarget && !dropTarget.contains(e.relatedTarget)) {
            removePlaceholder();
        }
    }

    function handleDrop(e) {
        const dropTarget = e.target.closest('.list-group');
        if (dropTarget) {
            e.preventDefault();
            const afterElement = getDragAfterElement(dropTarget, e.clientY);
            moveSelectedItems(dropTarget, afterElement);
            removePlaceholder();
        }
    }
    
    // --- Helper Functions for Drag & Drop ---
    
    function moveSelectedItems(targetList, beforeElement) {
        const selected = document.querySelectorAll('.list-group-item.selected');
        selected.forEach(item => {
            targetList.insertBefore(item, beforeElement);
            item.classList.remove('selected');
        });
        updateAllCounts();
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.list-group-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    
    function removePlaceholder() {
         if (placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }
    }


    // --- Event Listeners for Controls ---
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            fileNameSpan.textContent = file.name;
            parseCsvFile(file);
        } else {
            fileNameSpan.textContent = 'No file chosen';
        }
    });

    generateButton.addEventListener('click', generateXlsxFile);
    
    // --- Core Application Logic ---
    function parseCsvFile(file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const requiredColumns = ['What is your name?', 'How many people are you requesting for?', 'Pickup point next to you?', 'Other (Please Specify)', priorityColumn];
                const hasRequiredColumns = requiredColumns.every(col => results.meta.fields.includes(col));

                if (!results.data.length || !hasRequiredColumns) {
                    const missingColumn = requiredColumns.find(col => !results.meta.fields.includes(col)) || "a required column";
                    showToast(`Error: CSV is missing the column: "${missingColumn}"`, true);
                    return;
                }
                processAndDisplayData(results.data);
            },
            error: function(error) {
                 showToast("Error parsing CSV file: " + error.message, true);
            }
        });
    }
    
    function createPersonElement(person, index) {
        const personId = `person-${index}`;
        const name = person['What is your name?'] || 'N/A';
        const numPeople = person['How many people are you requesting for?'] || '0';
        
        const pickupPoint = person['Pickup point next to you?'] || 'N/A';
        const otherLocation = person['Other (Please Specify)'] || 'N/A';
        const location = pickupPoint === 'Other Addresses more than 1km from the above pickup points' ? otherLocation : pickupPoint;

        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.dataset.id = personId;
        item.dataset.name = name;
        item.dataset.location = location;
        item.dataset.people = numPeople;
        item.draggable = true;

        // Check for priority status and add the highlight class
        if (person[priorityColumn] === 'Yes') {
            item.classList.add('priority-item');
        }

        item.innerHTML = `
            <p style="font-weight: 600;">${name}</p>
            <p style="font-size: 0.875rem; color: #4b5563;">${location}</p>
            <p style="font-size: 0.875rem; color: #6b7280;">Group Size: <span style="font-weight: 500;">${numPeople}</span></p>
        `;
        return item;
    }

    function processAndDisplayData(data) {
        unassignedList.innerHTML = '';
        document.querySelectorAll('#assigned-columns .list-group').forEach(col => col.innerHTML = '');

        const specialLocations = ["Total Garage Braamfontein", "15 Yale Road"];
        const taxiColumnIds = ['special-taxi-load-1', 'special-taxi-load-2', 'special-taxi-load-3'];
        let taxiTotals = { 'special-taxi-load-1': 0, 'special-taxi-load-2': 0, 'special-taxi-load-3': 0 };
        const taxiCapacity = 18;

        data.forEach((person, index) => {
            const personElement = createPersonElement(person, index);
            const pickupPoint = person['Pickup point next to you?'] || '';
            const otherLocation = person['Other (Please Specify)'] || '';
            const location = pickupPoint === 'Other Addresses more than 1km from the above pickup points' ? otherLocation : pickupPoint;
            const numPeople = parseInt(person['How many people are you requesting for?'], 10) || 0;
            
            let assigned = false;
            if (specialLocations.includes(location)) {
                for (const taxiId of taxiColumnIds) {
                    if (taxiTotals[taxiId] + numPeople <= taxiCapacity) {
                        document.getElementById(taxiId).appendChild(personElement);
                        taxiTotals[taxiId] += numPeople;
                        assigned = true;
                        break;
                    }
                }
            }

            if (!assigned) {
                unassignedList.appendChild(personElement);
            }
        });
        updateAllCounts();
    }
    
    function updateColumnCounts(columnEl) {
        const items = columnEl.children;
        let requestCount = 0;
        let totalPeople = 0;
        for (const item of items) {
            if (!item.classList.contains('placeholder')) {
                 requestCount++;
                 totalPeople += parseInt(item.dataset.people, 10) || 0;
            }
        }
        const countElId = `${columnEl.id}-count`;
        const peopleCountElId = `${columnEl.id}-people-count`;
        const countEl = document.getElementById(countElId);
        const peopleCountEl = document.getElementById(peopleCountElId);
        if (countEl) countEl.textContent = `Requests: ${requestCount}`;
        if (peopleCountEl) peopleCountEl.textContent = `Total People: ${totalPeople}`;
    }

    function updateAllCounts() {
        document.querySelectorAll('.list-group').forEach(updateColumnCounts);
    }
    
    function showToast(message, isError = false) {
        messageText.textContent = message;
        messageBox.style.backgroundColor = isError ? '#ef4444' : '#22c55e';
        messageBox.classList.remove('hidden');
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 3000);
    }

    function generateXlsxFile() {
        const wb = XLSX.utils.book_new();

        document.querySelectorAll('#assigned-columns .list-group').forEach(column => {
            const sheetName = column.parentElement.querySelector('h3').textContent;
            const data = [];
            data.push(['Name', 'Pickup Location', 'Number of People', 'Time']);

            column.querySelectorAll('.list-group-item').forEach(item => {
                data.push([item.dataset.name, item.dataset.location, item.dataset.people, '']);
            });
            
            if(data.length > 1) {
                 const ws = XLSX.utils.aoa_to_sheet(data);
                 ws['!cols'] = [ {wch:25}, {wch:40}, {wch:20}, {wch:20} ];
                 XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
            }
        });
        
        const unassignedItems = document.querySelectorAll('#unassigned-list .list-group-item');
        if (unassignedItems.length > 0) {
            const sheetName = "Private Lifts & Uber";
            const data = [];
            data.push(['Name', 'Pickup Location', 'Number of People', 'Time']);

            unassignedItems.forEach(item => {
                data.push([item.dataset.name, item.dataset.location, item.dataset.people, '']);
            });
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [ {wch:25}, {wch:40}, {wch:20}, {wch:20} ];
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        if (wb.SheetNames.length === 0) {
            showToast("There is no one to allocate.", true);
            return;
        }

        XLSX.writeFile(wb, 'Transport_Allocations.xlsx');
        showToast("Successfully generated Allocations.xlsx!", false);
    }
}
