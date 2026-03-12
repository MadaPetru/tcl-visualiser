import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, OnDestroy } from '@angular/core';

interface Node {
  id: string;
  x: number;
  y: number;
}

interface Link {
  from: string;
  to: string;
}

interface Packet {
  fromNode: Node;
  toNode: Node;
  progress: number;
  color: string;
}

@Component({
  selector: 'app-network-animator',
  templateUrl: './network-animator.component.html',
  styleUrls: ['./network-animator.component.css']
})
export class NetworkAnimatorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('networkCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private nodes: Map<string, Node> = new Map();
  private links: Link[] = [];
  private packets: Packet[] = [];
  private animationFrameId: number = 0;
  private trafficIntervalId: any = null;
  private tclContent: string = '';

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeAndRedraw();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    if (this.trafficIntervalId) {
      clearInterval(this.trafficIntervalId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeAndRedraw();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.tclContent = e.target?.result as string;
        this.parseTclAndDraw(this.tclContent);
      };
      reader.readAsText(file);
    }
  }

  private resizeAndRedraw(): void {
    this.resizeCanvas();
    if (this.tclContent) {
      this.parseTclAndDraw(this.tclContent);
    } else {
      // If there's no content, at least clear the canvas
      this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    }
  }

  private parseTclAndDraw(content: string): void {
    this.nodes.clear();
    this.links = [];
    this.packets = [];
    cancelAnimationFrame(this.animationFrameId);
    if (this.trafficIntervalId) {
      clearInterval(this.trafficIntervalId);
    }

    const nodeRegex = /set\s+(n\d+)\s+\[\$ns\s+node\]/g;
    let match;
    const nodeIds: string[] = [];
    while ((match = nodeRegex.exec(content)) !== null) {
      nodeIds.push(match[1]);
    }

    const centerX = this.canvasRef.nativeElement.width / 2;
    const centerY = this.canvasRef.nativeElement.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8; // Use 80% of available space

    nodeIds.forEach((id, index) => {
      const angle = (index / nodeIds.length) * 2 * Math.PI - Math.PI / 2;
      this.nodes.set(id, {
        id: id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    const linkRegex = /\$ns\s+(?:duplex-link|simplex-link)\s+\$(n\d+)\s+\$(n\d+)/g;
    while ((match = linkRegex.exec(content)) !== null) {
      this.links.push({ from: match[1], to: match[2] });
    }

    this.generateMockTraffic();
    this.animate();
  }

  private generateMockTraffic(): void {
    if (this.links.length === 0) return;

    this.trafficIntervalId = setInterval(() => {
      const randomLink = this.links[Math.floor(Math.random() * this.links.length)];
      const fromNode = this.nodes.get(randomLink.from);
      const toNode = this.nodes.get(randomLink.to);

      if (fromNode && toNode) {
        this.packets.push({
          fromNode,
          toNode,
          progress: 0,
          color: Math.random() > 0.5 ? '#ff4d4d' : '#4dff4d'
        });
      }
    }, 500);
  }

  private animate = (): void => {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#888';
    this.links.forEach(link => {
      const from = this.nodes.get(link.from);
      const to = this.nodes.get(link.to);
      if (from && to) {
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
      }
    });

    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.progress += 0.01;

      if (p.progress >= 1) {
        this.packets.splice(i, 1);
        continue;
      }

      const currentX = p.fromNode.x + (p.toNode.x - p.fromNode.x) * p.progress;
      const currentY = p.fromNode.y + (p.toNode.y - p.fromNode.y) * p.progress;

      this.ctx.beginPath();
      this.ctx.arc(currentX, currentY, 5, 0, 2 * Math.PI);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
    }

    this.nodes.forEach(node => {
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#4a90e2';
      this.ctx.fill();
      this.ctx.strokeStyle = '#2a6099';
      this.ctx.stroke();

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(node.id, node.x, node.y);
    });

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const wrapper = canvas.parentElement;
    if (wrapper) {
      canvas.width = wrapper.clientWidth;
      canvas.height = wrapper.clientWidth * (9 / 16); // Maintain a 16:9 aspect ratio
    } else {
      // Fallback for safety
      canvas.width = 800;
      canvas.height = 450;
    }
  }
}
