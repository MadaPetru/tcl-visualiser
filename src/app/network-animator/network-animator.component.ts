import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';

interface Node { id: string; x: number; y: number; }
interface Link { from: string; to: string; }
interface PacketEvent {
  id: string;
  from: string;
  to: string;
  startTime: number;
  endTime: number;
  color: string;
}
interface LinkStateEvent {
  from: string;
  to: string;
  time: number;
  state: 'UP' | 'DOWN';
}

@Component({
  selector: 'app-network-animator',
  templateUrl: './network-animator.component.html',
  styleUrls: ['./network-animator.component.css']
})
export class NetworkAnimatorComponent implements AfterViewInit {
  @ViewChild('networkCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private nodes: Map<string, Node> = new Map();
  private links: Link[] = [];
  private packetEvents: PacketEvent[] = [];
  private linkStates: LinkStateEvent[] = [];

  // Controale de timp
  public isPlaying = false;
  public simulationTime = 0;
  public maxSimulationTime = 0;
  public playbackSpeed = 1.0;
  private lastFrameTime = 0;
  private animationFrameId: number = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.drawFrame();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.drawFrame();
  }

  // Citeste fisierul .nam
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.parseNamData(content);
      };
      reader.readAsText(file);
    }
  }

  private parseNamData(content: string): void {
    this.resetState();
    const lines = content.split('\n');
    const uniqueNodes = new Set<string>();
    const pendingPackets = new Map<string, Partial<PacketEvent>>();

    for (const line of lines) {
      if (line.startsWith('l -t *')) {
        const sMatch = line.match(/-s\s+(\d+)/);
        const dMatch = line.match(/-d\s+(\d+)/);
        if (sMatch && dMatch) {
          uniqueNodes.add(sMatch[1]);
          uniqueNodes.add(dMatch[1]);
          if (!this.links.find(l => (l.from === sMatch[1] && l.to === dMatch[1]) || (l.from === dMatch[1] && l.to === sMatch[1]))) {
            this.links.push({ from: sMatch[1], to: dMatch[1] });
          }
        }
      } else if (line.startsWith('l -t ') && !line.startsWith('l -t *')) {
        const tMatch = line.match(/-t\s+([\d.]+)/);
        const sMatch = line.match(/-s\s+(\d+)/);
        const dMatch = line.match(/-d\s+(\d+)/);
        const stateMatch = line.match(/-S\s+(UP|DOWN)/);
        if (tMatch && sMatch && dMatch && stateMatch) {
          this.linkStates.push({
            from: sMatch[1], to: dMatch[1],
            time: parseFloat(tMatch[1]),
            state: stateMatch[1] as 'UP' | 'DOWN'
          });
        }
      } else if (line.startsWith('h ')) {
        const tMatch = line.match(/-t\s+([\d.]+)/);
        const sMatch = line.match(/-s\s+(\d+)/);
        const dMatch = line.match(/-d\s+(\d+)/);
        const iMatch = line.match(/-i\s+(\d+)/);
        const cMatch = line.match(/-c\s+(\d+)/);
        if (tMatch && sMatch && dMatch && iMatch) {
          const pId = iMatch[1];
          const time = parseFloat(tMatch[1]);
          const key = `${pId}_${sMatch[1]}_${dMatch[1]}`;
          pendingPackets.set(key, {
            id: pId, from: sMatch[1], to: dMatch[1],
            startTime: time,
            color: cMatch ? this.getColorCode(cMatch[1]) : '#333'
          });
        }
      } else if (line.startsWith('r ')) {
        const tMatch = line.match(/-t\s+([\d.]+)/);
        const sMatch = line.match(/-s\s+(\d+)/);
        const dMatch = line.match(/-d\s+(\d+)/);
        const iMatch = line.match(/-i\s+(\d+)/);
        if (tMatch && sMatch && dMatch && iMatch) {
          const pId = iMatch[1];
          const key = `${pId}_${sMatch[1]}_${dMatch[1]}`;
          const pending = pendingPackets.get(key);
          if (pending && pending.startTime !== undefined) {
            const endTime = parseFloat(tMatch[1]);
            this.packetEvents.push({
              id: pending.id as string, from: pending.from as string, to: pending.to as string,
              startTime: pending.startTime, endTime: endTime, color: pending.color as string
            });
            pendingPackets.delete(key);
            if (endTime > this.maxSimulationTime) this.maxSimulationTime = endTime;
          }
        }
      }
    }

    this.calculateLayout(Array.from(uniqueNodes).sort());
    this.drawFrame();
  }

  private resetState(): void {
    this.nodes.clear();
    this.links = [];
    this.packetEvents = [];
    this.linkStates = [];
    this.simulationTime = 0;
    this.maxSimulationTime = 0;
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private getColorCode(id: string): string {
    if (id === '1') return '#ff4d4d';
    if (id === '2') return '#4dff4d';
    return '#555555';
  }

  private calculateLayout(nodeIds: string[]): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    nodeIds.forEach((id, index) => {
      const angle = (index / nodeIds.length) * 2 * Math.PI - Math.PI / 2;
      this.nodes.set(id, { id, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
    });
  }

  // --- CONTROALE PLAYER ---
  public togglePlay(): void {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    } else {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public resetSim(): void {
    this.simulationTime = 0;
    this.drawFrame();
  }

  public onTimeScrub(event: any): void {
    this.simulationTime = parseFloat(event.target.value);
    if (!this.isPlaying) {
      this.drawFrame();
    }
  }

  public onSpeedChange(event: any): void {
    this.playbackSpeed = parseFloat(event.target.value);
  }

  private gameLoop = (currentTime: number): void => {
    if (!this.isPlaying) return;

    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.simulationTime += deltaTime * this.playbackSpeed;
    if (this.simulationTime >= this.maxSimulationTime) {
      this.simulationTime = this.maxSimulationTime;
      this.isPlaying = false;
    }

    this.drawFrame();

    if (this.isPlaying) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  // --- RANDARE GRAFICA ---
  private drawFrame(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Link-uri
    this.ctx.lineWidth = 3;
    this.links.forEach(link => {
      let isDown = false;
      const stateChanges = this.linkStates.filter(s =>
        ((s.from === link.from && s.to === link.to) || (s.from === link.to && s.to === link.from))
        && s.time <= this.simulationTime
      ).sort((a, b) => a.time - b.time);

      if (stateChanges.length > 0) {
        if (stateChanges[stateChanges.length - 1].state === 'DOWN') isDown = true;
      }

      const fromNode = this.nodes.get(link.from);
      const toNode = this.nodes.get(link.to);
      if (fromNode && toNode) {
        this.ctx.beginPath();
        this.ctx.moveTo(fromNode.x, fromNode.y);
        this.ctx.lineTo(toNode.x, toNode.y);
        this.ctx.strokeStyle = isDown ? '#ffb3b3' : '#cccccc';
        this.ctx.setLineDash(isDown ? [5, 10] : []);
        this.ctx.stroke();
      }
    });
    this.ctx.setLineDash([]);

    // Pachete
    this.packetEvents.filter(p => this.simulationTime >= p.startTime && this.simulationTime <= p.endTime)
      .forEach(p => {
        const fromNode = this.nodes.get(p.from);
        const toNode = this.nodes.get(p.to);
        if (fromNode && toNode) {
          const duration = p.endTime - p.startTime;
          const progress = duration > 0 ? (this.simulationTime - p.startTime) / duration : 1;
          const currentX = fromNode.x + (toNode.x - fromNode.x) * progress;
          const currentY = fromNode.y + (toNode.y - fromNode.y) * progress;

          this.ctx.beginPath();
          this.ctx.arc(currentX, currentY, 6, 0, 2 * Math.PI);
          this.ctx.fillStyle = p.color;
          this.ctx.fill();
          this.ctx.strokeStyle = '#000';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      });

    // Noduri
    this.nodes.forEach(node => {
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#4a90e2';
      this.ctx.fill();
      this.ctx.strokeStyle = '#2a6099';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('n' + node.id, node.x, node.y);
    });
  }

  private resizeCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      this.calculateLayout(Array.from(this.nodes.keys()).sort());
    }
  }
}
