class BucketMemoryVisualizer {
    constructor() {
        // DOM elements
        this.bucketsContainer = document.getElementById('bucketsContainer');
        this.currentStepDisplay = document.getElementById('currentStep');
        this.currentRefDisplay = document.getElementById('currentRef');
        this.currentActionDisplay = document.getElementById('currentAction');
        this.faultsDisplay = document.getElementById('faults');
        this.hitsDisplay = document.getElementById('hits');
        this.hitRatioDisplay = document.getElementById('hitRatio');
        this.logOutput = document.getElementById('logOutput');
        
        // Buttons
        this.startBtn = document.getElementById('startBtn');
        this.stepBtn = document.getElementById('stepBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.clearLogBtn = document.getElementById('clearLog');
        this.downloadLogBtn = document.getElementById('downloadLog');
        
        // Inputs
        this.frameCountInput = document.getElementById('frameCount');
        this.referenceStringInput = document.getElementById('referenceString');
        this.algorithmSelect = document.getElementById('algorithm');
        
        // State
        this.buckets = [];
        this.pageTable = {};
        this.stats = {
            faults: 0,
            hits: 0
        };
        this.currentStep = 0;
        this.referenceString = [];
        this.isRunning = false;
        this.simulationTimeout = null;
        
        // Initialize
        this.setupEventListeners();
        this.createBuckets();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startSimulation());
        this.stepBtn.addEventListener('click', () => this.stepSimulation());
        this.resetBtn.addEventListener('click', () => this.resetSimulation());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        this.downloadLogBtn.addEventListener('click', () => this.downloadLogAsPDF());
        this.frameCountInput.addEventListener('change', () => this.createBuckets());
    }
    
    createBuckets() {
        this.bucketsContainer.innerHTML = '';
        this.buckets = [];
        const bucketCount = parseInt(this.frameCountInput.value);
        
        for (let i = 0; i < bucketCount; i++) {
            const bucket = document.createElement('div');
            bucket.className = 'bucket';
            bucket.innerHTML = `
                <div class="bucket-header">Frame ${i}</div>
                <div class="bucket-content"></div>
            `;
            this.bucketsContainer.appendChild(bucket);
            this.buckets.push({
                element: bucket,
                content: bucket.querySelector('.bucket-content'),
                pages: [],
                loadedAt: null,
                lastUsed: null
            });
            
            // Add free item by default
            this.addBucketItem(i, 'Free', 'free');
        }
    }
    
    addBucketItem(bucketIndex, value, className = '') {
        this.buckets[bucketIndex].content.innerHTML = ''; // Clear bucket
        const item = document.createElement('div');
        item.className = `bucket-item ${className}`;
        item.textContent = value;
        this.buckets[bucketIndex].content.appendChild(item);
        return item;
    }
    
    startSimulation() {
        if (this.isRunning) return;
        
        this.parseReferenceString();
        if (this.referenceString.length === 0) {
            this.log('Error: Invalid reference string');
            return;
        }
        
        this.isRunning = true;
        this.currentStep = 0;
        this.stats = { faults: 0, hits: 0 };
        this.pageTable = {};
        this.updateStats();
        this.createBuckets(); // Reset buckets
        
        this.log('Simulation started');
        this.runSimulation();
    }
    
    parseReferenceString() {
        try {
            this.referenceString = this.referenceStringInput.value
                .split(',')
                .map(ref => ref.trim())
                .filter(ref => ref !== '');
        } catch (e) {
            this.referenceString = [];
        }
    }
    
    runSimulation() {
        if (!this.isRunning || this.currentStep >= this.referenceString.length) {
            this.isRunning = false;
            this.currentActionDisplay.textContent = 'Completed';
            this.log('Simulation completed');
            return;
        }
        
        this.stepSimulation();
        this.simulationTimeout = setTimeout(() => this.runSimulation(), 800);
    }
    
    stepSimulation() {
        if (this.currentStep >= this.referenceString.length) return;

        const ref = this.referenceString[this.currentStep];
        this.currentStepDisplay.textContent = this.currentStep + 1;
        this.currentRefDisplay.textContent = ref;
        this.log(`Processing reference: ${ref}`);

        // Highlight processing state
        this.currentActionDisplay.textContent = 'Processing...';
        
        // Check if reference is already in a bucket
        const bucketIndex = this.findReferenceInBuckets(ref);
        if (bucketIndex !== -1) {
            // Hit
            this.processHit(bucketIndex, ref);
        } else {
            // Fault - need to add to a bucket
            this.processFault(ref);
        }

        this.currentStep++;
        this.updateStats();
    }
    
    findReferenceInBuckets(ref) {
        for (let i = 0; i < this.buckets.length; i++) {
            if (this.buckets[i].pages.includes(ref)) {
                return i;
            }
        }
        return -1;
    }
    
    processHit(bucketIndex, ref) {
        this.stats.hits++;
        this.buckets[bucketIndex].lastUsed = this.currentStep;
        
        // Highlight the bucket
        this.buckets[bucketIndex].element.classList.add('processing');
        
        // Highlight the specific item that was hit
        const items = this.buckets[bucketIndex].content.children;
        for (let item of items) {
            if (item.textContent === ref) {
                item.classList.add('hit');
                break;
            }
        }
        
        this.currentActionDisplay.textContent = 'Hit';
        this.log(`Hit: ${ref} found in Bucket ${bucketIndex}`);
        
        // Remove highlights after delay
        setTimeout(() => {
            this.buckets[bucketIndex].element.classList.remove('processing');
            for (let item of items) {
                item.classList.remove('hit');
            }
        }, 500);
    }
    
    processFault(ref) {
        this.stats.faults++;
        
        // Find bucket to replace (using FIFO or LRU)
        let bucketIndex = this.findBucketToReplace();
        
        // Clear the bucket and add new reference
        this.buckets[bucketIndex].pages = [ref];
        this.buckets[bucketIndex].loadedAt = this.currentStep;
        this.buckets[bucketIndex].lastUsed = this.currentStep;
        const item = this.addBucketItem(bucketIndex, ref);
        
        // Highlight the bucket
        this.buckets[bucketIndex].element.classList.add('processing');
        item.classList.add('fault');
        
        // Update page table
        this.pageTable[ref] = bucketIndex;
        
        this.currentActionDisplay.textContent = 'Page Fault';
        this.log(`Fault: ${ref} added to Bucket ${bucketIndex}`);
        
        // Remove highlights after delay
        setTimeout(() => {
            this.buckets[bucketIndex].element.classList.remove('processing');
            item.classList.remove('fault');
        }, 500);
    }
    
    findBucketToReplace() {
        if (this.algorithmSelect.value === 'FIFO') {
            // FIFO - find bucket with oldest loadedAt
            let oldestIndex = 0;
            let oldestTime = Infinity;
            
            for (let i = 0; i < this.buckets.length; i++) {
                if (this.buckets[i].loadedAt === null) return i;
                if (this.buckets[i].loadedAt < oldestTime) {
                    oldestTime = this.buckets[i].loadedAt;
                    oldestIndex = i;
                }
            }
            return oldestIndex;
        } else {
            // LRU - find bucket with oldest lastUsed
            let lruIndex = 0;
            let oldestTime = Infinity;
            
            for (let i = 0; i < this.buckets.length; i++) {
                if (this.buckets[i].lastUsed === null) return i;
                if (this.buckets[i].lastUsed < oldestTime) {
                    oldestTime = this.buckets[i].lastUsed;
                    lruIndex = i;
                }
            }
            return lruIndex;
        }
    }
    
    updateStats() {
        this.faultsDisplay.textContent = this.stats.faults;
        this.hitsDisplay.textContent = this.stats.hits;
        
        const total = this.stats.faults + this.stats.hits;
        const hitRatio = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;
        this.hitRatioDisplay.textContent = `${hitRatio}%`;
    }
    
    log(message, type = "info") {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[Step ${this.currentStep + 1}] ${message}`;
        this.logOutput.appendChild(entry);
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }
    
    clearLog() {
        this.logOutput.innerHTML = '';
        this.log("Log cleared", "info");
    }
    
    downloadLogAsPDF() {
        // Check if jsPDF is available through window.jspdf
        if (!window.jspdf) {
            this.log("Error: PDF library not loaded. Please include jsPDF in your HTML.", "error");
            return;
        }
    
        if (this.logOutput.children.length === 0) {
            this.log("No log entries to download", "warning");
            return;
        }
    
        try {
            // Access jsPDF through window.jspdf
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Rest of your PDF generation code remains the same...
            const pageWidth = doc.internal.pageSize.width;
            
            // Add title
            doc.setFontSize(18);
            doc.setTextColor(67, 97, 238);
            doc.text('Memory Bucket Simulation Report', pageWidth/2, 20, { align: 'center' });
            
            // Add simulation info
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Algorithm: ${this.algorithmSelect.value}`, 20, 35);
            doc.text(`Number of Buckets: ${this.frameCountInput.value}`, 20, 45);
            doc.text(`Reference String: ${this.referenceStringInput.value}`, 20, 55);
            
            // Add current memory state visualization
            doc.setFontSize(14);
            doc.setTextColor(67, 97, 238);
            doc.text('Memory Buckets State', pageWidth/2, 75, { align: 'center' });
            
            // Draw bucket visualization
            const bucketWidth = 50;
            const startX = (pageWidth - (this.buckets.length * bucketWidth + (this.buckets.length-1)*10))/2;
            
            doc.setDrawColor(67, 97, 238);
            doc.setLineWidth(0.5);
            
            // Draw buckets
            for (let i = 0; i < this.buckets.length; i++) {
                const x = startX + i*(bucketWidth+10);
                
                // Bucket border
                doc.rect(x, 85, bucketWidth, 30);
                
                // Bucket label
                doc.setFontSize(12);
                doc.text(`Frame ${i}`, x + bucketWidth/2, 82, { align: 'center' });
                
                // Bucket content
                const content = this.buckets[i].pages[0] || 'Free';
                doc.setFontSize(14);
                doc.text(content.toString(), x + bucketWidth/2, 100, { align: 'center' });
            }
            
            // Add current status
            doc.setFontSize(14);
            doc.setTextColor(67, 97, 238);
            doc.text('Current Status', 20, 130);
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Step: ${this.currentStepDisplay.textContent}`, 20, 140);
            doc.text(`Processing: ${this.currentRefDisplay.textContent}`, 20, 150);
            doc.text(`Action: ${this.currentActionDisplay.textContent}`, 20, 160);
            
            // Add statistics
            doc.setFontSize(14);
            doc.setTextColor(67, 97, 238);
            doc.text('Statistics', 20, 180);
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Page Faults: ${this.stats.faults}`, 20, 190);
            doc.text(`Hits: ${this.stats.hits}`, 20, 200);
            doc.text(`Hit Ratio: ${this.hitRatioDisplay.textContent}`, 20, 210);
            
            // Add event log
            doc.addPage();
            doc.setFontSize(18);
            doc.setTextColor(67, 97, 238);
            doc.text('Event Log', pageWidth/2, 20, { align: 'center' });
            
            doc.setFontSize(12);
            let y = 30;
            const entries = Array.from(this.logOutput.children);
            
            for (let i = 0; i < entries.length; i++) {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                
                // Color code based on entry type
                const entry = entries[i];
                if (entry.textContent.includes('Hit:')) {
                    doc.setTextColor(0, 128, 0); // Green for hits
                } else if (entry.textContent.includes('Fault:')) {
                    doc.setTextColor(200, 0, 0); // Red for faults
                } else {
                    doc.setTextColor(0, 0, 0); // Black for others
                }
                
                doc.text(entry.textContent, 20, y);
                y += 7;
            }
            
            // Add timestamp
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const timestamp = new Date().toLocaleString();
            doc.text(`Report generated: ${timestamp}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: 'right' });
            
            // Save the PDF
            const filename = `memory-simulation-report-${new Date().toISOString().slice(0,10)}.pdf`;
            doc.save(filename);
            
            this.log("PDF report generated successfully", "success");
        } catch (error) {
            this.log(`Error generating PDF: ${error.message}`, "error");
            console.error("PDF generation error:", error);
        }
    }
    
    resetSimulation() {
        this.isRunning = false;
        clearTimeout(this.simulationTimeout);
        this.currentStep = 0;
        this.stats = { faults: 0, hits: 0 };
        
        this.currentStepDisplay.textContent = '0';
        this.currentRefDisplay.textContent = '-';
        this.currentActionDisplay.textContent = 'Ready';
        
        this.updateStats();
        this.clearLog();
        this.createBuckets();
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    new BucketMemoryVisualizer();
});