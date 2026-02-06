# Phase 1: World Rendering and Movement - Implementation Plan

## Overview

**Goal**: Show the town and agents moving in a controllable camera without any server or AI dependencies.

**End State Requirements**:
- Full map with crisp, aligned 16x16 tiles
- At least one agent follows a path across walkable tiles
- Camera pan (click-drag or WASD) and zoom (mouse wheel) with map bounds
- No server required - runs from `npm run dev:client` with static client
- Frame-time overlay displays stable FPS

## Expert corrections (supersedes conflicting details below)

1. Use map-derived bounds, not hardcoded world size:
   - Camera bounds and world dimensions should come from loaded tilemap dimensions.
   - Keep `MAP_WIDTH_TILES` and `MAP_HEIGHT_TILES` only as fallback defaults.
2. Use delta-time movement everywhere:
   - Agent movement must be in units per second (`speedPxPerSecond`) and multiplied by frame delta.
   - Avoid per-frame movement constants (for example, `2 px/frame`) because behavior changes by FPS.
3. Mac-friendly camera controls are required:
   - Keep WASD and wheel zoom.
   - Add left-drag pan with a modifier key (for example, `Space + drag`) so trackpad users are not blocked.
4. Keep Phase 1 focused on proving the render/movement loop:
   - Placeholder art is acceptable in this phase.
   - Do not spend phase time on advanced asset polish.
5. Pathfinding implementation choice:
   - Current array-sort A* is acceptable for Phase 1.
   - Note explicitly that production pathfinding in later phases should use a priority queue/min-heap implementation.

## Tech Stack

- **Build**: Vite 5.x
- **Game Engine**: Phaser 3.70+
- **Language**: TypeScript 5.3+
- **Tile Size**: 16x16 pixels
- **Scaling**: Nearest-neighbor (pixel-perfect)

## Project Structure

```
src/client/
├── index.ts                    # Phaser game bootstrap
├── game/
│   ├── scenes/
│   │   ├── BootScene.ts        # Asset loading, tilemap parsing
│   │   └── TownScene.ts        # Main game scene with rendering
│   ├── sprites/
│   │   └── AgentSprite.ts      # Agent sprite with movement/animation
│   ├── camera/
│   │   └── CameraController.ts # Pan/zoom with bounds clamping
│   └── pathfinding/
│       └── AStar.ts            # A* pathfinding on collision grid
├── ui/
│   └── (empty for Phase 1)
assets/
├── tiles/
│   ├── town.json               # Tiled JSON export
│   └── tileset.png             # 16x16 tileset image
└── sprites/
    └── (placeholder agent sprites)
```

## Dependencies

The existing `package.json` already includes:
- `phaser: ^3.70.0`
- `vite: ^5.0.0`
- `typescript: ^5.3.0`

No additional dependencies required for Phase 1.

---

## Task Breakdown

### Task 1: Create Vite + Phaser Client Bootstrap

**Objective**: Boot Phaser with a visible background color confirming the render loop is alive.

**Files to Create/Modify**:
- `src/client/index.ts`
- `src/client/game/scenes/BootScene.ts`
- `src/client/game/scenes/TownScene.ts`

**Implementation Steps**:

1. **Create `src/client/index.ts`**:
   ```typescript
   import Phaser from 'phaser';
   import { BootScene } from './game/scenes/BootScene';
   import { TownScene } from './game/scenes/TownScene';
   import { TILE_SIZE, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '@shared/Constants';

   const config: Phaser.Types.Core.GameConfig = {
     type: Phaser.AUTO,
     parent: 'game-container',
     width: MAP_WIDTH_TILES * TILE_SIZE,  // 640px
     height: MAP_HEIGHT_TILES * TILE_SIZE, // 480px
     pixelArt: true,  // Enables nearest-neighbor scaling
     backgroundColor: '#2d2d44',
     scene: [BootScene, TownScene],
     physics: {
       default: 'arcade',
       arcade: {
         gravity: { x: 0, y: 0 },
         debug: false
       }
     },
     scale: {
       mode: Phaser.Scale.FIT,
       autoCenter: Phaser.Scale.CENTER_BOTH
     }
   };

   new Phaser.Game(config);
   ```

2. **Create `src/client/game/scenes/BootScene.ts`**:
   - Preload tilemap JSON and tileset PNG
   - Preload placeholder agent sprites (colored squares initially)
   - Transition to TownScene on complete

3. **Create `src/client/game/scenes/TownScene.ts`**:
   - Initial version: render solid background color
   - Log "TownScene created" to confirm scene transition

**Verification**:
- Run `npm run dev:client`
- Browser shows colored canvas (not black/white)
- Console logs confirm BootScene → TownScene transition

---

### Task 2: Import and Render Tiled JSON Tilemap

**Objective**: Load a Tiled JSON tilemap with ground + object layers, render with crisp 16x16 alignment.

**Files to Create/Modify**:
- `assets/tiles/town.json` (Tiled export)
- `assets/tiles/tileset.png` (tileset image)
- `src/client/game/scenes/BootScene.ts` (add asset loading)
- `src/client/game/scenes/TownScene.ts` (tilemap rendering)

**Implementation Steps**:

1. **Create Placeholder Tilemap** (if not provided):
   - Use Tiled to create a 40x30 tile map (640x480 pixels)
   - Layers required:
     - `ground` - base terrain (grass, paths, water)
     - `objects` - buildings, trees, decorations
     - `above` - elements rendered above agents (rooftops, tree canopies)
     - `collision` - walkable/blocked tiles (can be invisible)
   - Export as JSON with embedded tileset

2. **Modify `BootScene.ts`** to load assets:
   ```typescript
   preload() {
     this.load.image('tileset', 'assets/tiles/tileset.png');
     this.load.tilemapTiledJSON('townmap', 'assets/tiles/town.json');
   }
   ```

3. **Modify `TownScene.ts`** to render tilemap:
   ```typescript
   create() {
     // Create tilemap
     const map = this.make.tilemap({ key: 'townmap' });
     const tileset = map.addTilesetImage('tileset-name', 'tileset');
     
     // Render layers in order (bottom to top)
     const groundLayer = map.createLayer('ground', tileset, 0, 0);
     const objectsLayer = map.createLayer('objects', tileset, 0, 0);
     const aboveLayer = map.createLayer('above', tileset, 0, 0);
     
     // Set above layer depth for proper sorting
     aboveLayer.setDepth(100);
     
     // Parse collision layer for pathfinding (Task 4)
     this.collisionLayer = map.getLayer('collision');
   }
   ```

4. **Configure Nearest-Neighbor Scaling**:
   - Already set via `pixelArt: true` in game config
   - Verify tileset has no anti-aliasing artifacts

**Tilemap Requirements**:
| Property | Value |
|----------|-------|
| Tile Size | 16x16 pixels |
| Map Size | 40x30 tiles (640x480 px) |
| Format | JSON (Tiled export) |
| Layers | ground, objects, above, collision |

**Verification**:
- Tiles render at exact pixel boundaries (no sub-pixel blur)
- All four layers visible/functional
- No gaps between tiles
- Map dimensions match config (640x480)

---

### Task 3: Debug Agents Array with Colored Sprites

**Objective**: Spawn 3-5 debug agents at known tile coordinates with unique colors.

**Files to Create/Modify**:
- `src/client/game/sprites/AgentSprite.ts`
- `src/client/game/scenes/TownScene.ts`

**Implementation Steps**:

1. **Create `AgentSprite.ts`**:
   ```typescript
   import Phaser from 'phaser';
   import { TILE_SIZE } from '@shared/Constants';
   import { AgentData, TilePosition } from '@shared/Types';

   export class AgentSprite extends Phaser.GameObjects.Rectangle {
     public agentId: string;
     public currentTile: TilePosition;
     public path: TilePosition[] = [];
     public pathIndex: number = 0;
     public moveSpeed: number = 2; // pixels per frame
     
     constructor(scene: Phaser.Scene, data: AgentData) {
       // Create 12x12 colored rectangle (slightly smaller than tile)
       super(
         scene,
         data.tilePosition.tileX * TILE_SIZE + TILE_SIZE / 2,
         data.tilePosition.tileY * TILE_SIZE + TILE_SIZE / 2,
         12, 12,
         data.color
       );
       
       this.agentId = data.id;
       this.currentTile = { ...data.tilePosition };
       this.setDepth(10); // Above ground, below 'above' layer
       
       scene.add.existing(this);
     }
     
     public setPath(path: TilePosition[]): void {
       this.path = path;
       this.pathIndex = 0;
     }
     
     public update(time: number, delta: number): void {
       if (this.path.length === 0 || this.pathIndex >= this.path.length) {
         return;
       }
       
       const target = this.path[this.pathIndex];
       const targetX = target.tileX * TILE_SIZE + TILE_SIZE / 2;
       const targetY = target.tileY * TILE_SIZE + TILE_SIZE / 2;
       
       const dx = targetX - this.x;
       const dy = targetY - this.y;
       const distance = Math.sqrt(dx * dx + dy * dy);
       
       if (distance < this.moveSpeed) {
         this.x = targetX;
         this.y = targetY;
         this.currentTile = { ...target };
         this.pathIndex++;
       } else {
         this.x += (dx / distance) * this.moveSpeed;
         this.y += (dy / distance) * this.moveSpeed;
       }
     }
   }
   ```

2. **Add debug agents in `TownScene.ts`**:
   ```typescript
   private agents: AgentSprite[] = [];
   private debugAgentData: AgentData[] = [
     { id: 'agent-1', name: 'Red', position: {x: 0, y: 0}, tilePosition: { tileX: 5, tileY: 5 }, state: AgentState.Idle, color: 0xff4444 },
     { id: 'agent-2', name: 'Green', position: {x: 0, y: 0}, tilePosition: { tileX: 15, tileY: 10 }, state: AgentState.Idle, color: 0x44ff44 },
     { id: 'agent-3', name: 'Blue', position: {x: 0, y: 0}, tilePosition: { tileX: 25, tileY: 20 }, state: AgentState.Idle, color: 0x4444ff },
     { id: 'agent-4', name: 'Yellow', position: {x: 0, y: 0}, tilePosition: { tileX: 35, tileY: 8 }, state: AgentState.Idle, color: 0xffff44 },
     { id: 'agent-5', name: 'Purple', position: {x: 0, y: 0}, tilePosition: { tileX: 20, tileY: 25 }, state: AgentState.Idle, color: 0xff44ff }
   ];
   
   create() {
     // ... tilemap setup ...
     
     // Spawn debug agents
     this.debugAgentData.forEach(data => {
       const agent = new AgentSprite(this, data);
       this.agents.push(agent);
     });
   }
   
   update(time: number, delta: number) {
     this.agents.forEach(agent => agent.update(time, delta));
   }
   ```

**Verification**:
- 5 colored squares visible at different positions
- Agents render above ground layer, below 'above' layer
- Agents are centered within their tiles

---

### Task 4: Client-Side A* Pathfinding with Click-to-Move

**Objective**: Implement A* pathfinding on collision layer; one agent moves to clicked tile.

**Files to Create/Modify**:
- `src/client/game/pathfinding/AStar.ts`
- `src/client/game/scenes/TownScene.ts`

**Implementation Steps**:

1. **Create `AStar.ts`**:
   ```typescript
   import { TilePosition } from '@shared/Types';

   interface AStarNode {
     x: number;
     y: number;
     g: number;  // Cost from start
     h: number;  // Heuristic to goal
     f: number;  // Total cost (g + h)
     parent: AStarNode | null;
   }

   export class AStar {
     private grid: boolean[][];  // true = walkable
     private width: number;
     private height: number;
     
     constructor(collisionData: boolean[][]) {
       this.grid = collisionData;
       this.height = collisionData.length;
       this.width = collisionData[0]?.length || 0;
     }
     
     public static fromTilemapLayer(
       layer: Phaser.Tilemaps.LayerData,
       blockedTileIds: number[]
     ): AStar {
       const grid: boolean[][] = [];
       for (let y = 0; y < layer.height; y++) {
         grid[y] = [];
         for (let x = 0; x < layer.width; x++) {
           const tile = layer.data[y][x];
           // Walkable if no tile or tile not in blocked list
           grid[y][x] = !tile || !blockedTileIds.includes(tile.index);
         }
       }
       return new AStar(grid);
     }
     
     public findPath(
       start: TilePosition,
       end: TilePosition
     ): TilePosition[] | null {
       if (!this.isWalkable(end.tileX, end.tileY)) {
         return null;
       }
       
       const openList: AStarNode[] = [];
       const closedSet = new Set<string>();
       
       const startNode: AStarNode = {
         x: start.tileX,
         y: start.tileY,
         g: 0,
         h: this.heuristic(start.tileX, start.tileY, end.tileX, end.tileY),
         f: 0,
         parent: null
       };
       startNode.f = startNode.g + startNode.h;
       openList.push(startNode);
       
       while (openList.length > 0) {
         // Get node with lowest f
         openList.sort((a, b) => a.f - b.f);
         const current = openList.shift()!;
         
         if (current.x === end.tileX && current.y === end.tileY) {
           return this.reconstructPath(current);
         }
         
         closedSet.add(`${current.x},${current.y}`);
         
         // Check neighbors (4-directional)
         const neighbors = [
           { x: current.x - 1, y: current.y },
           { x: current.x + 1, y: current.y },
           { x: current.x, y: current.y - 1 },
           { x: current.x, y: current.y + 1 }
         ];
         
         for (const neighbor of neighbors) {
           if (!this.isWalkable(neighbor.x, neighbor.y)) continue;
           if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;
           
           const g = current.g + 1;
           const h = this.heuristic(neighbor.x, neighbor.y, end.tileX, end.tileY);
           const f = g + h;
           
           const existing = openList.find(
             n => n.x === neighbor.x && n.y === neighbor.y
           );
           
           if (!existing) {
             openList.push({
               x: neighbor.x,
               y: neighbor.y,
               g, h, f,
               parent: current
             });
           } else if (g < existing.g) {
             existing.g = g;
             existing.f = f;
             existing.parent = current;
           }
         }
       }
       
       return null; // No path found
     }
     
     private isWalkable(x: number, y: number): boolean {
       if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
         return false;
       }
       return this.grid[y][x];
     }
     
     private heuristic(x1: number, y1: number, x2: number, y2: number): number {
       // Manhattan distance
       return Math.abs(x1 - x2) + Math.abs(y1 - y2);
     }
     
     private reconstructPath(node: AStarNode): TilePosition[] {
       const path: TilePosition[] = [];
       let current: AStarNode | null = node;
       while (current) {
         path.unshift({ tileX: current.x, tileY: current.y });
         current = current.parent;
       }
       return path;
     }
   }
   ```

2. **Integrate click-to-move in `TownScene.ts`**:
   ```typescript
   private astar: AStar;
   private selectedAgent: AgentSprite | null = null;
   
   create() {
     // ... previous setup ...
     
     // Parse collision layer into A* grid
     const collisionLayerData = this.map.getLayer('collision');
     this.astar = AStar.fromTilemapLayer(collisionLayerData, [1]); // Tile ID 1 = blocked
     
     // Select first agent for click-to-move demo
     this.selectedAgent = this.agents[0];
     
     // Add click handler
     this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
       if (!this.selectedAgent) return;
       
       const tileX = Math.floor(pointer.worldX / TILE_SIZE);
       const tileY = Math.floor(pointer.worldY / TILE_SIZE);
       
       const path = this.astar.findPath(
         this.selectedAgent.currentTile,
         { tileX, tileY }
       );
       
       if (path) {
         this.selectedAgent.setPath(path);
         console.log(`Path found: ${path.length} tiles`);
       } else {
         console.log('No path to destination');
       }
     });
   }
   ```

**Verification**:
- Click on walkable tile → agent moves along path
- Click on blocked tile → console shows "No path"
- Agent stops at destination tile
- Path follows walkable tiles only (no diagonal shortcuts through walls)

---

### Task 5: Camera Pan and Zoom with Map Bounds

**Objective**: Implement camera controls (WASD/drag pan, scroll zoom) clamped to map bounds.

**Files to Create/Modify**:
- `src/client/game/camera/CameraController.ts`
- `src/client/game/scenes/TownScene.ts`

**Implementation Steps**:

1. **Create `CameraController.ts`**:
   ```typescript
   import Phaser from 'phaser';
   import { 
     TILE_SIZE, 
     MAP_WIDTH_TILES, 
     MAP_HEIGHT_TILES,
     CAMERA_ZOOM_MIN,
     CAMERA_ZOOM_MAX,
     CAMERA_ZOOM_STEP
   } from '@shared/Constants';

   export class CameraController {
     private scene: Phaser.Scene;
     private camera: Phaser.Cameras.Scene2D.Camera;
     private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
     private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
     
     private isDragging: boolean = false;
     private dragStartX: number = 0;
     private dragStartY: number = 0;
     private cameraStartX: number = 0;
     private cameraStartY: number = 0;
     
     private panSpeed: number = 8;
     private mapWidth: number;
     private mapHeight: number;
     
     constructor(scene: Phaser.Scene) {
       this.scene = scene;
       this.camera = scene.cameras.main;
       this.mapWidth = MAP_WIDTH_TILES * TILE_SIZE;
       this.mapHeight = MAP_HEIGHT_TILES * TILE_SIZE;
       
       // Set camera bounds to map size
       this.camera.setBounds(0, 0, this.mapWidth, this.mapHeight);
       
       // Setup keyboard controls
       this.cursors = scene.input.keyboard!.createCursorKeys();
       this.wasd = {
         W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
         A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
         S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
         D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
       };
       
       // Setup mouse drag for panning
       scene.input.on('pointerdown', this.onPointerDown, this);
       scene.input.on('pointermove', this.onPointerMove, this);
       scene.input.on('pointerup', this.onPointerUp, this);
       
       // Setup mouse wheel for zoom
       scene.input.on('wheel', this.onWheel, this);
     }
     
     private onPointerDown(pointer: Phaser.Input.Pointer): void {
       // Middle mouse or right mouse for drag (left is for agent selection)
       if (pointer.middleButtonDown() || pointer.rightButtonDown()) {
         this.isDragging = true;
         this.dragStartX = pointer.x;
         this.dragStartY = pointer.y;
         this.cameraStartX = this.camera.scrollX;
         this.cameraStartY = this.camera.scrollY;
       }
     }
     
     private onPointerMove(pointer: Phaser.Input.Pointer): void {
       if (!this.isDragging) return;
       
       const dx = this.dragStartX - pointer.x;
       const dy = this.dragStartY - pointer.y;
       
       this.camera.scrollX = this.cameraStartX + dx / this.camera.zoom;
       this.camera.scrollY = this.cameraStartY + dy / this.camera.zoom;
     }
     
     private onPointerUp(pointer: Phaser.Input.Pointer): void {
       this.isDragging = false;
     }
     
     private onWheel(
       pointer: Phaser.Input.Pointer,
       gameObjects: Phaser.GameObjects.GameObject[],
       deltaX: number,
       deltaY: number
     ): void {
       const zoomChange = deltaY > 0 ? -CAMERA_ZOOM_STEP : CAMERA_ZOOM_STEP;
       const newZoom = Phaser.Math.Clamp(
         this.camera.zoom + zoomChange,
         CAMERA_ZOOM_MIN,
         CAMERA_ZOOM_MAX
       );
       
       // Zoom toward pointer position
       const worldPointBefore = this.camera.getWorldPoint(pointer.x, pointer.y);
       this.camera.setZoom(newZoom);
       const worldPointAfter = this.camera.getWorldPoint(pointer.x, pointer.y);
       
       this.camera.scrollX += worldPointBefore.x - worldPointAfter.x;
       this.camera.scrollY += worldPointBefore.y - worldPointAfter.y;
     }
     
     public update(): void {
       // WASD / Arrow key panning
       let dx = 0;
       let dy = 0;
       
       if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= this.panSpeed;
       if (this.cursors.right.isDown || this.wasd.D.isDown) dx += this.panSpeed;
       if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= this.panSpeed;
       if (this.cursors.down.isDown || this.wasd.S.isDown) dy += this.panSpeed;
       
       if (dx !== 0 || dy !== 0) {
         this.camera.scrollX += dx / this.camera.zoom;
         this.camera.scrollY += dy / this.camera.zoom;
       }
     }
     
     public destroy(): void {
       this.scene.input.off('pointerdown', this.onPointerDown, this);
       this.scene.input.off('pointermove', this.onPointerMove, this);
       this.scene.input.off('pointerup', this.onPointerUp, this);
       this.scene.input.off('wheel', this.onWheel, this);
     }
   }
   ```

2. **Integrate in `TownScene.ts`**:
   ```typescript
   private cameraController: CameraController;
   
   create() {
     // ... previous setup ...
     
     // Initialize camera controller
     this.cameraController = new CameraController(this);
     
     // Center camera initially
     this.cameras.main.centerOn(
       this.mapWidth / 2,
       this.mapHeight / 2
     );
   }
   
   update(time: number, delta: number) {
     this.cameraController.update();
     this.agents.forEach(agent => agent.update(time, delta));
   }
   ```

**Verification**:
- WASD/Arrow keys pan the camera
- Middle/right mouse drag pans the camera
- Mouse wheel zooms in/out
- Camera never shows area outside map bounds
- Zoom range: 0.5x to 3x
- Pan speed feels responsive but not jerky

---

### Task 6: Frame-Time Overlay for FPS Monitoring

**Objective**: Display FPS counter in corner to confirm stable performance.

**Files to Modify**:
- `src/client/game/scenes/TownScene.ts`
- `index.html` (already has `#fps-overlay` div)

**Implementation Steps**:

1. **Add FPS update in `TownScene.ts`**:
   ```typescript
   private fpsText: HTMLElement | null = null;
   private fpsUpdateTimer: number = 0;
   private fpsUpdateInterval: number = 250; // Update every 250ms
   
   create() {
     // ... previous setup ...
     
     // Get FPS overlay element
     this.fpsText = document.getElementById('fps-overlay');
   }
   
   update(time: number, delta: number) {
     // ... agent and camera updates ...
     
     // Update FPS display
     this.fpsUpdateTimer += delta;
     if (this.fpsUpdateTimer >= this.fpsUpdateInterval) {
       this.fpsUpdateTimer = 0;
       if (this.fpsText) {
         const fps = Math.round(this.game.loop.actualFps);
         const frameTime = delta.toFixed(1);
         this.fpsText.textContent = `FPS: ${fps} | Frame: ${frameTime}ms`;
       }
     }
   }
   ```

2. **Style already in `index.html`**:
   ```html
   <div id="fps-overlay">FPS: --</div>
   ```
   
   CSS (already present):
   ```css
   #fps-overlay {
     position: fixed;
     top: 10px;
     left: 10px;
     color: #00ff00;
     font-family: monospace;
     font-size: 12px;
     background: rgba(0, 0, 0, 0.7);
     padding: 5px 10px;
     border-radius: 3px;
     z-index: 1000;
   }
   ```

**Verification**:
- FPS counter visible in top-left corner
- Updates smoothly (not every frame to avoid flicker)
- Shows stable 60 FPS during normal operation
- Frame time shows milliseconds per frame

---

## Asset Requirements

### Tileset (`assets/tiles/tileset.png`)

Create or source a 16x16 pixel tileset with:
- Grass tiles (base terrain)
- Path/road tiles
- Water tiles
- Building tiles (walls, roofs, doors)
- Tree tiles
- Fence tiles
- Decoration tiles

**Minimum tiles needed**: 20-30 unique tiles

### Tilemap (`assets/tiles/town.json`)

Create in Tiled with:
- **Map size**: 40x30 tiles
- **Tile size**: 16x16 pixels
- **Layers**:
  - `ground` - Base layer (grass, paths, water)
  - `objects` - Interactive layer (buildings, trees)
  - `above` - Overlay layer (rooftops, tree canopies)
  - `collision` - Blocked tiles (set tile ID for blocked areas)
- **Export format**: JSON

### Placeholder Agent Sprites

For Phase 1, colored rectangles suffice. Full sprites in later phases.

---

## Success Criteria Checklist

| Requirement | Verification Method |
|------------|---------------------|
| Phaser boots with visible background | Canvas shows non-black/white color |
| Tilemap renders with crisp 16x16 tiles | Visual inspection - no blur, no gaps |
| All 4 layers render in correct order | Objects above ground, 'above' above agents |
| 3-5 debug agents visible | Count colored squares on screen |
| A* pathfinding works | Click walkable tile → agent moves |
| Blocked tiles respected | Click blocked tile → "No path" in console |
| WASD/arrow panning works | Keys move camera smoothly |
| Mouse drag panning works | Middle/right click drag moves camera |
| Mouse wheel zoom works | Scroll changes zoom level |
| Camera bounded to map | Cannot see outside map edges at any zoom |
| FPS overlay visible | Green text in top-left shows FPS |
| Stable 60 FPS | FPS counter shows ~60 during movement |
| Runs without server | `npm run dev:client` only, no errors |

---

## Implementation Order

Execute tasks in this sequence for incremental verification:

1. **Task 1**: Bootstrap Phaser → Verify render loop
2. **Task 6**: FPS overlay → Verify performance baseline
3. **Task 2**: Tilemap rendering → Verify assets and layers
4. **Task 3**: Debug agents → Verify sprite depth ordering
5. **Task 4**: A* pathfinding → Verify movement system
6. **Task 5**: Camera controls → Verify bounds and input handling

---

## Potential Challenges and Mitigations

### Challenge 1: Tileset not found or misaligned

**Symptoms**: Black screen, missing tiles, gaps between tiles

**Mitigation**:
- Verify asset paths in BootScene match actual file locations
- Ensure tileset name in JSON matches `addTilesetImage()` call
- Check tile margins and spacing in Tiled export settings

### Challenge 2: A* pathfinding slow on large maps

**Symptoms**: Click-to-move has noticeable delay

**Mitigation**:
- Use binary heap for open list instead of array sort
- Cache common paths
- Limit pathfinding distance (e.g., max 50 tiles)

### Challenge 3: Camera jitter at boundaries

**Symptoms**: Camera stutters when hitting map edges

**Mitigation**:
- Use `setBounds()` instead of manual clamping
- Apply smoothing to scroll position changes
- Check zoom level affects bound calculations

### Challenge 4: Agents render behind tiles

**Symptoms**: Agents hidden by ground layer

**Mitigation**:
- Set explicit depth values on all layers and sprites
- Verify layer creation order
- Use `setDepth()` on agent sprites

---

## File Creation Checklist

**New Files to Create**:
- [ ] `src/client/index.ts`
- [ ] `src/client/game/scenes/BootScene.ts`
- [ ] `src/client/game/scenes/TownScene.ts`
- [ ] `src/client/game/sprites/AgentSprite.ts`
- [ ] `src/client/game/camera/CameraController.ts`
- [ ] `src/client/game/pathfinding/AStar.ts`
- [ ] `assets/tiles/town.json` (Tiled export)
- [ ] `assets/tiles/tileset.png` (tileset image)

**Files Already Exist** (from worktree scaffold):
- [x] `index.html`
- [x] `package.json`
- [x] `vite.config.ts`
- [x] `tsconfig.json`
- [x] `src/shared/Types.ts`
- [x] `src/shared/Constants.ts`
- [x] `src/shared/Events.ts`

---

## Testing Commands

```bash
# Install dependencies (first time)
npm install

# Start client only (Phase 1 requirement)
npm run dev:client

# Build for production
npm run build

# Run unit tests (if any)
npm run test
```

---

## Notes for Implementer

1. **Pixel Art Mode**: The `pixelArt: true` config option is critical for crisp rendering. Do not enable any smoothing or anti-aliasing.

2. **Coordinate Systems**: Phaser uses pixels, the game logic uses tiles. Always convert between them using `TILE_SIZE`.

3. **Layer Depths**: Use explicit depth values:
   - Ground: 0
   - Objects: 1-5
   - Agents: 10
   - Above layer: 100
   - UI: 1000

4. **No Server**: Phase 1 is entirely client-side. All agent data is hardcoded debug data.

5. **Collision Layer**: The collision layer can use a simple tile (e.g., tile ID 1) to mark blocked areas. It doesn't need to be visible.
