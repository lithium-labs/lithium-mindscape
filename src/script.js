function saveCode() {
    const code = codeInput.value;
    localStorage.setItem('savedCode', code);
    console.log('Code saved successfully.');
}

function highlight() {
    const code = codeInput.value;
    codeHighlight.textContent = code;
    Prism.highlightElement(codeHighlight);
}

function loadCode() {
    const savedCode = localStorage.getItem('savedCode');
    if (savedCode) {
        codeInput.value = savedCode; // Load the saved code into the input
        console.log('Code loaded successfully.');
        highlight(); // Highlight the loaded code
    } else {
        console.warn('No saved code found.');
    }
}

const closingBrackets = {
    '(': ')',
    '{': '}',
    '[': ']',
    '"': '"',
    "'": "'",
    "`": "`"
};

codeInput.addEventListener("keydown", (event) => {
    // Handle Tab key for indentation
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent the default tab behavior
        const start = codeInput.selectionStart;
        const end = codeInput.selectionEnd;

        // Set textarea value to: text before caret + tab + text after caret
        codeInput.value = 
            codeInput.value.substring(0, start) + 
            "\t" + 
            codeInput.value.substring(end);

        // Move the caret to the right
        codeInput.selectionStart = codeInput.selectionEnd = start + 1;
        highlight();
    }

    // Handle auto-closing brackets
    if (event.key in closingBrackets) {
        const start = codeInput.selectionStart;
        const end = codeInput.selectionEnd;

        const nextChar = codeInput.value[start];

        console.log(nextChar);
        console.log(event.key);
        if (
            nextChar &&
            nextChar.trim() !== '' &&
            nextChar === closingBrackets[event.key]
        ) {
            return;
        }

        const openingChar = event.key;
        const openingCount = (codeInput.value.slice(0, start).match(new RegExp('\\' + openingChar, 'g')) || []).length;
        const closingCount = (codeInput.value.slice(0, start).match(new RegExp('\\' + closingBrackets[openingChar], 'g')) || []).length;

        if (openingCount > closingCount) {
            return;
        }

        event.preventDefault();

        if (start !== end) {
            codeInput.value = 
                codeInput.value.substring(0, start) + 
                openingChar + 
                closingBrackets[openingChar] + 
                codeInput.value.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + 1;
        } else {
            codeInput.value = 
                codeInput.value.substring(0, start) + 
                openingChar + 
                closingBrackets[openingChar] + 
                codeInput.value.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + 1;
        }
        highlight();
    }

    // Handle Backspace for deleting matching quotes or brackets
    if (event.key === "Backspace") {
        const start = codeInput.selectionStart;
        const end = codeInput.selectionEnd;

        // Check if the cursor is at the start of the input or if there's no selection
        if (start === end && start > 0) {
            const charBefore = codeInput.value[start - 1];
            const charBefore2 = codeInput.value[start - 2];

            // Check if the character before the cursor is an opening bracket or quote
            if (closingBrackets[charBefore] && charBefore2 !== "\\") {
                // Find the corresponding closing bracket or quote
                const closingChar = closingBrackets[charBefore];
                const closingIndex = codeInput.value.indexOf(closingChar, start);

                // Check if the closing character exists after the opening character
                if (closingIndex !== -1) {
                    event.preventDefault(); // Prevent the default backspace behavior
                    // Remove both the opening and closing characters
                    codeInput.value = 
                        codeInput.value.substring(0, start - 1) + 
                        codeInput.value.substring(closingIndex + 1);
                    // Move the caret back to the correct position
                    codeInput.selectionStart = codeInput.selectionEnd = start - 1;
                    highlight();
                }
            }
        }
    }
});