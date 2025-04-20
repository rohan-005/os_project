class MemoryVisualizer {
    constructor() {
        this.canvas = document.getElementById('memoryCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.consoleLog = document.getElementById('consoleLog');
        this.statsDisplay = document.getElementById('statsDisplay');
        
        // Initialize default configuration
        this.config = {
            memorySize: 64,          // in KB
            pageSize: 4,            // in KB
            algorithm: 'FIFO',
            processSize: 32,         // in KB
            referenceString: '1,2,3,4,1,2,5,1,2,3,4,5'
        };
        
        // Simulation state
        this.simulationState = {
            running: false,
            currentStep: 0,
            memory: [],
            pageTable: {},
            tlb: {},
            stats: {
                pageFaults: 0,
                hits: 0,
                fragmentation: 0
            }
        };
        
        this.setupUI();
        this.initializeMemory();
        this.render();
    }
    
    setupUI() {
        // Add configuration controls dynamically
        const controlPanel = document.querySelector('.control-panel');
        
        // Memory size input
        controlPanel.innerHTML += `
            <div class="control-group">
                <label for="memorySize">Memory Size (KB):</label>
                <input type="number" id="memorySize" value="${this.config.memorySize}" min="16" max="1024">
            </div>
        `;
        
        // Page size input
        controlPanel.innerHTML += `
            <div class="control-group">
                <label for="pageSize">Page/Frame Size (KB):</label>
                <input type="number" id="pageSize" value="${this.config.pageSize}" min="1" max="16">
            </div>
        `;
        
        // Algorithm selection
        controlPanel.innerHTML += `
            <div class="control-group">
                <label for="algorithm">Page Replacement Algorithm:</label>
                <select id="algorithm">
                    <option value="FIFO">FIFO</option>
                    <option value="LRU">LRU</option>
                    <option value="OPT">Optimal</option>
                </select>
            </div>
        `;
        
        // Process size input
        controlPanel.innerHTML += `
            <div class="control-group">
                <label for="processSize">Process Size (KB):</label>
                <input type="number" id="processSize" value="${this.config.processSize}" min="1">
            </div>
        `;
        
        // Reference string input
        controlPanel.innerHTML += `
            <div class="control-group">
                <label for="referenceString">Reference String (comma separated):</label>
                <input type="text" id="referenceString" value="${this.config.referenceString}">
            </div>
        `;
        
        // Add apply button
        controlPanel.innerHTML += `
            <button id="applyConfig">Apply Configuration</button>
        `;
        
        // Set up event listeners
        document.getElementById('playBtn').addEventListener('click', () => this.startSimulation());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseSimulation());
        document.getElementById('stepBtn').addEventListener('click', () => this.stepSimulation());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetSimulation());
        document.getElementById('applyConfig').addEventListener('click', () => this.applyConfiguration());
    }
    
    applyConfiguration() {
        this.config.memorySize = parseInt(document.getElementById('memorySize').value);
        this.config.pageSize = parseInt(document.getElementById('pageSize').value);
        this.config.algorithm = document.getElementById('algorithm').value;
        this.config.processSize = parseInt(document.getElementById('processSize').value);
        this.config.referenceString = document.getElementById('referenceString').value;
        
        this.resetSimulation();
        this.log("Configuration applied successfully.");
    }
    
    initializeMemory() {
        const frameCount = Math.floor(this.config.memorySize / this.config.pageSize);
        this.simulationState.memory = Array(frameCount).fill(null);
        
        // Initialize page table
        const pageCount = Math.ceil(this.config.processSize / this.config.pageSize);
        this.simulationState.pageTable = {};
        for (let i = 0; i < pageCount; i++) {
            this.simulationState.pageTable[i] = {
                frame: null,
                valid: false,
                referenced: false,
                modified: false
            };
        }
        
        // Initialize TLB (simplified)
        this.simulationState.tlb = {};
        this.simulationState.tlbSize = Math.min(4, frameCount); // Small TLB
        
        // Parse reference string
        this.simulationState.referenceString = this.config.referenceString
            .split(',')
            .map(ref => parseInt(ref.trim()));
        
        // Reset stats
        this.simulationState.stats = {
            pageFaults: 0,
            hits: 0,
            fragmentation: 0
        };
        
        this.simulationState.currentStep = 0;
    }
    
    startSimulation() {
        if (!this.simulationState.running) {
            this.simulationState.running = true;
            this.runSimulationLoop();
        }
    }
    
    pauseSimulation() {
        this.simulationState.running = false;
    }
    
    stepSimulation() {
        if (!this.simulationState.running && 
            this.simulationState.currentStep < this.simulationState.referenceString.length) {
            this.processMemoryAccess();
            this.render();
        }
    }
    
    resetSimulation() {
        this.simulationState.running = false;
        this.initializeMemory();
        this.render();
    }
    
    runSimulationLoop() {
        if (this.simulationState.running && 
            this.simulationState.currentStep < this.simulationState.referenceString.length) {
            this.processMemoryAccess();
            this.render();
            setTimeout(() => this.runSimulationLoop(), 1000); // 1 second per step
        } else {
            this.simulationState.running = false;
        }
    }
    
    processMemoryAccess() {
        const currentRef = this.simulationState.referenceString[this.simulationState.currentStep];
        const pageNumber = Math.floor(currentRef / this.config.pageSize);
        
        this.log(`Processing reference to page ${pageNumber}...`);
        
        // Check TLB first (simplified)
        if (this.simulationState.tlb[pageNumber] !== undefined) {
            this.simulationState.stats.hits++;
            this.simulationState.pageTable[pageNumber].referenced = true;
            this.log(`TLB hit for page ${pageNumber} (Frame ${this.simulationState.tlb[pageNumber]})`);
        } 
        // Check page table
        else if (this.simulationState.pageTable[pageNumber].valid) {
            this.simulationState.stats.hits++;
            this.simulationState.pageTable[pageNumber].referenced = true;
            
            // Update TLB (simplified FIFO)
            const tlbPages = Object.keys(this.simulationState.tlb);
            if (tlbPages.length >= this.simulationState.tlbSize) {
                delete this.simulationState.tlb[tlbPages[0]];
            }
            this.simulationState.tlb[pageNumber] = this.simulationState.pageTable[pageNumber].frame;
            
            this.log(`Page table hit for page ${pageNumber} (Frame ${this.simulationState.pageTable[pageNumber].frame})`);
        }
        // Page fault
        else {
            this.simulationState.stats.pageFaults++;
            this.log(`Page fault for page ${pageNumber}`);
            
            // Find a free frame
            let freeFrame = this.simulationState.memory.indexOf(null);
            
            // If no free frame, use replacement algorithm
            if (freeFrame === -1) {
                freeFrame = this.selectFrameToReplace();
                this.log(`Replacing frame ${freeFrame} using ${this.config.algorithm} algorithm`);
                
                // Update page table for evicted page
                const evictedPage = Object.keys(this.simulationState.pageTable).find(
                    pg => this.simulationState.pageTable[pg].frame === freeFrame
                );
                if (evictedPage) {
                    this.simulationState.pageTable[evictedPage].valid = false;
                    this.simulationState.pageTable[evictedPage].frame = null;
                    
                    // Remove from TLB if present
                    if (this.simulationState.tlb[evictedPage] !== undefined) {
                        delete this.simulationState.tlb[evictedPage];
                    }
                }
            }
            
            // Allocate the frame
            this.simulationState.memory[freeFrame] = pageNumber;
            this.simulationState.pageTable[pageNumber].frame = freeFrame;
            this.simulationState.pageTable[pageNumber].valid = true;
            this.simulationState.pageTable[pageNumber].referenced = true;
            
            // Update TLB
            const tlbPages = Object.keys(this.simulationState.tlb);
            if (tlbPages.length >= this.simulationState.tlbSize) {
                delete this.simulationState.tlb[tlbPages[0]];
            }
            this.simulationState.tlb[pageNumber] = freeFrame;
            
            this.log(`Page ${pageNumber} loaded into frame ${freeFrame}`);
        }
        
        this.simulationState.currentStep++;
        
        // Calculate fragmentation (simplified)
        const freeFrames = this.simulationState.memory.filter(f => f === null).length;
        this.simulationState.stats.fragmentation = 
            (freeFrames * this.config.pageSize) / this.config.memorySize;
    }
    
    selectFrameToReplace() {
        switch (this.config.algorithm) {
            case 'FIFO':
                return this.fifoReplacement();
            case 'LRU':
                return this.lruReplacement();
            case 'OPT':
                return this.optimalReplacement();
            default:
                return 0; // Default to first frame
        }
    }
    
    fifoReplacement() {
        // Simple FIFO implementation - replace the frame that was loaded first
        const framesInUse = this.simulationState.memory
            .map((page, frame) => page !== null ? frame : null)
            .filter(f => f !== null);
        
        return framesInUse[0]; // Replace the oldest frame
    }
    
    lruReplacement() {
        // Simple LRU implementation - replace the least recently used page
        let lruFrame = 0;
        let oldestAccess = Infinity;
        
        for (const [page, data] of Object.entries(this.simulationState.pageTable)) {
            if (data.valid) {
                // Find when this page was last referenced in the reference string
                const lastRefIndex = this.simulationState.referenceString
                    .slice(0, this.simulationState.currentStep)
                    .lastIndexOf(parseInt(page));
                
                if (lastRefIndex < oldestAccess) {
                    oldestAccess = lastRefIndex;
                    lruFrame = data.frame;
                }
            }
        }
        
        return lruFrame;
    }
    
    optimalReplacement() {
        // Optimal replacement - replace the page not used for longest time in future
        let optimalFrame = 0;
        let farthestNextUse = -1;
        
        for (const [page, data] of Object.entries(this.simulationState.pageTable)) {
            if (data.valid) {
                // Find next use of this page in the remaining reference string
                const nextUseIndex = this.simulationState.referenceString
                    .slice(this.simulationState.currentStep)
                    .indexOf(parseInt(page));
                
                if (nextUseIndex === -1) {
                    // This page won't be used again - perfect candidate
                    return data.frame;
                } else if (nextUseIndex > farthestNextUse) {
                    farthestNextUse = nextUseIndex;
                    optimalFrame = data.frame;
                }
            }
        }
        
        return optimalFrame;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const frameCount = this.simulationState.memory.length;
        const frameWidth = this.canvas.width - 40;
        const frameHeight = 30;
        const startX = 20;
        const startY = 20;
        const gap = 10;
        
        // Draw memory frames
        for (let i = 0; i < frameCount; i++) {
            const y = startY + i * (frameHeight + gap);
            
            // Frame border
            this.ctx.strokeStyle = '#333';
            this.ctx.strokeRect(startX, y, frameWidth, frameHeight);
            
            // Frame content
            if (this.simulationState.memory[i] !== null) {
                this.ctx.fillStyle = this.getColorForPage(this.simulationState.memory[i]);
                this.ctx.fillRect(startX, y, frameWidth, frameHeight);
                
                // Page label
                this.ctx.fillStyle = '#000';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(`Page ${this.simulationState.memory[i]}`, startX + 10, y + 20);
            } else {
                this.ctx.fillStyle = '#f0f0f0';
                this.ctx.fillRect(startX, y, frameWidth, frameHeight);
                this.ctx.fillStyle = '#666';
                this.ctx.fillText('Free', startX + 10, y + 20);
            }
            
            // Frame number
            this.ctx.fillStyle = '#333';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`Frame ${i}`, startX + frameWidth - 70, y + 20);
        }
        
        // Draw current step indicator
        if (this.simulationState.currentStep < this.simulationState.referenceString.length) {
            const currentRef = this.simulationState.referenceString[this.simulationState.currentStep];
            this.ctx.fillStyle = '#333';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`Current Reference: ${currentRef}`, startX, startY + frameCount * (frameHeight + gap) + 30);
        }
        
        // Update statistics
        const hitRatio = this.simulationState.stats.hits + this.simulationState.stats.pageFaults > 0 
            ? (this.simulationState.stats.hits / (this.simulationState.stats.hits + this.simulationState.stats.pageFaults)).toFixed(2)
            : 0;
            
        this.statsDisplay.innerHTML = `
            <h3>Simulation Statistics</h3>
            <p>Page Faults: ${this.simulationState.stats.pageFaults}</p>
            <p>Hits: ${this.simulationState.stats.hits}</p>
            <p>Hit Ratio: ${hitRatio}</p>
            <p>Fragmentation: ${(this.simulationState.stats.fragmentation * 100).toFixed(1)}%</p>
            <p>Current Step: ${this.simulationState.currentStep}/${this.simulationState.referenceString.length}</p>
        `;
    }
    
    getColorForPage(pageNumber) {
        // Generate a consistent color for each page
        const colors = [
            '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', 
            '#B5EAD7', '#C7CEEA', '#F8B195', '#F67280',
            '#C06C84', '#6C5B7B', '#355C7D', '#A8E6CE'
        ];
        return colors[pageNumber % colors.length];
    }
    
    log(message) {
        this.consoleLog.innerHTML += `<div>${message}</div>`;
        this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
    }
}

// Initialize the visualizer when the page loads
window.onload = () => {
    new MemoryVisualizer();
};