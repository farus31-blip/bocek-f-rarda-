import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gameAudio } from './audio';
import { DEATH_REASONS, ZONES, pickDialogue } from './dialogues';
import {
  CockroachRig,
  bakeStaticGroup,
  createBathRampModel,
  createBathSegmentProps,
  createBeakerVatModel,
  createBiomeTransitionGateModel,
  createBroomModel,
  createButterBlockModel,
  createCheeseAsteroidModel,
  createCityBusWithRampModel,
  createCityTreeModel,
  createCockroachModel,
  createConeBarrierModel,
  createDumpsterModel,
  createEarthBoulderModel,
  createEarthCavernSegmentProps,
  createEarthRampModel,
  createFireBarrelModel,
  createFirePillarModel,
  createFireWorldSegmentProps,
  createGiantSlipperModel,
  createIceCrystalModel,
  createIceRampModel,
  createIceWallModel,
  createIceWorldSegmentProps,
  createIcicleArchModel,
  createJellyCubeModel,
  createKitchenRampModel,
  createKitchenSegmentProps,
  createLabRampModel,
  createLabSegmentProps,
  createLaserArchModel,
  createLavaRampModel,
  createLavaRockModel,
  createMagmaArchModel,
  createMineCartModel,
  createMovingTaxiModel,
  createMushroomClusterModel,
  createPhoneRoachObstacle,
  createPowerupModel,
  createRaidCanModel,
  createRecordGateModel,
  createRoadSignHighModel,
  createRollingPinModel,
  createRootArchModel,
  createShowcasePedestal,
  createSimitCoinModel,
  createSkywaySegmentModel,
  createSnowBallModel,
  createSoapBarModel,
  createSpaceMeteorModel,
  createSpaceRampModel,
  createSpaceSegmentProps,
  createSpectatorCockroachModel,
  createSpringPadModel,
  createStreetArchModel,
  createStreetLampModel,
  createTaxiModel,
  createTireModel,
  createToasterArchModel,
  createTomatoBallModel,
  createTowelArchModel,
  createTpRollModel,
  createTunnelDescentModel,
  createTunnelStaircaseExitModel,
  createUfoSaucerModel,
  createWarpArchModel,
} from './models';
import { SKINS } from './storage';
import { CityTextureSet, createCityTextures } from './textures';
import {
  DialogueLine,
  DialogueTrigger,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  PowerupType,
  RunMetrics,
  SkinId,
  UpgradeKey,
  ZoneConfig,
  ZoneId,
} from './types';

// Exact 3-lane centers matching the 7.8m wide road (each lane = 2.6m wide!)
const ROAD_WIDTH = 7.8;
const LANE_X = [-2.6, 0, 2.6];
const SEGMENT_LENGTH = 20;
const SEGMENT_COUNT = 11;
const ZONE_DISTANCE = 1000;
const TUNNEL_DEPTH = -4.2;
const TRANSITION_IN_METERS = 24;
const TRANSITION_OUT_SECONDS = 0.85;
const BASE_SPEED = 18.5;
const MAX_SPEED = 36;
const ROLL_DURATION = 0.72;
const BUS_ROOF_Y = 1.95;
const MAX_SIM_STEP = 1 / 48;
const JET_EXHAUST_INTERVAL = 1 / 60;
const MENU_SHOWCASE_Z = -0.55;

const INITIAL_STAGE_ORDER: ZoneId[] = [
  'mahalle_caddesi',
  'yeralti_magarasi',
  'buzul_dunyasi',
  'ates_diyari',
  'dev_mutfak',
  'kopuklu_banyo',
  'cilgin_lab',
  'peynir_galaksisi',
];

type ObstacleKind =
  | 'taxi'
  | 'moving_taxi'
  | 'bus_ramp'
  | 'terrain_ramp'
  | 'spring_pad'
  | 'dumpster'
  | 'cone'
  | 'tire'
  | 'road_sign'
  | 'phone_roach'
  | 'mine_cart'
  | 'earth_boulder'
  | 'root_arch'
  | 'mushroom_cluster'
  | 'ice_wall'
  | 'ice_crystal'
  | 'icicle_arch'
  | 'snow_ball'
  | 'lava_rock'
  | 'fire_pillar'
  | 'magma_arch'
  | 'fire_barrel'
  | 'rolling_pin'
  | 'butter_block'
  | 'toaster_arch'
  | 'tomato_ball'
  | 'giant_slipper'
  | 'soap_bar'
  | 'towel_arch'
  | 'tp_roll'
  | 'raid_can'
  | 'beaker_vat'
  | 'laser_arch'
  | 'jelly_cube'
  | 'ufo_saucer'
  | 'cheese_asteroid'
  | 'warp_arch'
  | 'space_meteor';

interface ActiveObstacle {
  id: number;
  kind: ObstacleKind;
  poolKey: string;
  lane: number;
  z: number;
  baseY: number;
  mesh: THREE.Group;
  trafficSpeed?: number;
  visualX?: number;
  impactDone?: boolean;
  nearMissAwarded?: boolean;
  roofCredited?: boolean;
  height: number;
  minY: number;
  halfDepth: number;
}

interface ActiveCoin {
  lane: number;
  z: number;
  y: number;
  localY: number;
  isSkyCoin?: boolean;
  mesh: THREE.Group;
}

interface ActivePowerup {
  type: PowerupType;
  lane: number;
  z: number;
  baseY: number;
  localY?: number;
  mesh: THREE.Group;
}

interface StreetSegment {
  group: THREE.Group;
  spectators: THREE.Group[];
  biomeGroups: Record<ZoneId, THREE.Group>;
  activeBiomeGroup: THREE.Group;
  activeZoneId: ZoneId;
  skywayGroup: THREE.Group;
  biomeVisible: boolean;
}

interface QualityProfile {
  pixelRatioCap: number;
  lowResRatio: number | null;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  shadowFrustumHalf: number;
  envIntensity: number;
  toneExposure: number;
  cameraFar: number;
  segmentCutoffZ: number;
  fogNear: number;
  fogFar: number;
  starsRatio: number;
  particleRatio: number;
  burstMultiplier: number;
  anisotropyCap: number;
  headlampDistance: number;
  menuKeyIntensity: number;
  menuRimIntensity: number;
}

const QUALITY_PROFILES: Record<GraphicsQuality, QualityProfile> = {
  low: {
    pixelRatioCap: 0.65,
    lowResRatio: 0.62,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowFrustumHalf: 12,
    envIntensity: 0,
    toneExposure: 1.0,
    cameraFar: 96,
    segmentCutoffZ: -74,
    fogNear: 34,
    fogFar: 88,
    starsRatio: 0,
    particleRatio: 0.25,
    burstMultiplier: 0.35,
    anisotropyCap: 1,
    headlampDistance: 32,
    menuKeyIntensity: 2.1,
    menuRimIntensity: 0,
  },
  medium: {
    pixelRatioCap: 1.0,
    lowResRatio: null,
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowFrustumHalf: 13,
    envIntensity: 0.38,
    toneExposure: 1.06,
    cameraFar: 165,
    segmentCutoffZ: -135,
    fogNear: 58,
    fogFar: 152,
    starsRatio: 0.5,
    particleRatio: 0.6,
    burstMultiplier: 0.75,
    anisotropyCap: 4,
    headlampDistance: 46,
    menuKeyIntensity: 2.4,
    menuRimIntensity: 1.4,
  },
  high: {
    pixelRatioCap: 1.5,
    lowResRatio: null,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowFrustumHalf: 13,
    envIntensity: 0.72,
    toneExposure: 1.12,
    cameraFar: 250,
    segmentCutoffZ: -240,
    fogNear: 88,
    fogFar: 230,
    starsRatio: 1.0,
    particleRatio: 1.0,
    burstMultiplier: 1.2,
    anisotropyCap: 16,
    headlampDistance: 56,
    menuKeyIntensity: 2.7,
    menuRimIntensity: 2.2,
  },
};

interface PooledParticle {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  life: number;
  maxLife: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onDialogue: (line: DialogueLine) => void;
  onZoneChange: (zone: ZoneConfig) => void;
  onGameOver: (snapshot: HudSnapshot) => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _eulerA = new THREE.Euler();
const _mat4A = new THREE.Matrix4();
const _zeroScale = new THREE.Vector3(0, 0, 0);
const _colorA = new THREE.Color();
const _jetFireColor = new THREE.Color(0xff5500);
const _jetGoldColor = new THREE.Color(0xfacc15);
const _jetPhosphorColor = new THREE.Color(0x39ff14);
const _jetCyanColor = new THREE.Color(0x00e5ff);

export class RunnerEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: CityTextureSet;
  private maxAniso = 1;
  private envMapTexture: THREE.Texture | null = null;
  private sharedDisposables: { dispose: () => void }[] = [];
  private lastFrameMs = 0;
  private simTime = 0;
  private jetExhaustEmitAccum = 0;

  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private menuKeyLight!: THREE.PointLight;
  private menuRimLight!: THREE.PointLight;
  private headlamp!: THREE.SpotLight;
  private headlampTarget!: THREE.Object3D;

  private segments: StreetSegment[] = [];
  private stageZones: ZoneId[] = [...INITIAL_STAGE_ORDER];
  private transitionGateMesh!: THREE.Group;
  private transitionGateBoundaryDist = -1;
  private transitionGateBurstDone = false;
  private descentTunnelMesh!: THREE.Group;
  private staircaseExitMesh!: THREE.Group;
  private moonMesh!: THREE.Mesh;
  private starsPoints!: THREE.Points;
  private biomeParticles!: THREE.Points;
  private biomeParticlePositions!: Float32Array;
  private biomeParticleMat!: THREE.PointsMaterial;
  private snowNearPoints!: THREE.Points;
  private snowNearPositions!: Float32Array;
  private snowFarPoints!: THREE.Points;
  private snowFarPositions!: Float32Array;
  private playerRig!: CockroachRig;
  private pedestalGroup!: THREE.Group;
  private playerShadow!: THREE.Mesh;
  private broomMesh!: THREE.Group;
  private recordGateMesh!: THREE.Group;
  private recordGateActive = false;
  private recordGateZ = -999;
  private recordGatePassed = false;

  private obstacles: ActiveObstacle[] = [];
  private coins: ActiveCoin[] = [];
  private powerups: ActivePowerup[] = [];
  private obstaclePool = new Map<string, THREE.Group[]>();
  private powerupPool = new Map<PowerupType, THREE.Group[]>();
  private coinPool: THREE.Group[] = [];
  private particleInstancedMesh!: THREE.InstancedMesh;
  private particles: PooledParticle[] = [];
  private particleCursor = 0;
  private jetExhaustInstancedMesh!: THREE.InstancedMesh;
  private jetExhaustPool: PooledParticle[] = [];
  private jetExhaustCursor = 0;
  private flightCoinLane = 1;
  private skyPatternIndex = 0;
  private lastPowerupSpawnDist = -60;
  private lastJetpackSpawnDist = -160;
  private nextObstacleId = 1;

  private phase: GamePhase = 'menu';
  private currentSkinId: SkinId = 'kivircik_riza';
  private graphicsQuality: GraphicsQuality = 'high';
  private shopPreviewOpen = false;
  private menuSpinYaw = 0;
  private menuShowcaseX = 0;
  private menuTapTimer = 0;
  private highScore = 0;
  private score = 0;
  private distance = 0;
  private runCoins = 0;
  private speed = BASE_SPEED;
  private zoneIndex = 0;
  private biomeRevealTimer = 0;
  private deathReason = '';
  private isNewRecord = false;
  private continueCount = 0;
  private adReviveUsed = false;

  private upgrades: Record<UpgradeKey, number> = {
    magnet: 1,
    shield: 1,
    flashlight: 1,
    turbo: 1,
    wings: 1,
  };
  private bonusMultiplier = 1;
  private metrics: RunMetrics = {
    distance: 0,
    coins: 0,
    rolls: 0,
    jumps: 0,
    nearMisses: 0,
    flights: 0,
    powerups: 0,
    magnets: 0,
    shields: 0,
    flashlights: 0,
    turbos: 0,
    zonesReached: ['mahalle_caddesi'],
  };

  // 3-lane kinematics (0 = Sol, 1 = Orta, 2 = Sağ)
  private targetLane = 1;
  private playerX = 0;
  private playerY = 0;
  private currentGroundY = 0;
  private velY = 0;
  private isGrounded = true;
  private jumpBufferTimer = 0;
  private rollBufferTimer = 0;
  private rollTimer = 0;
  private longJumpSpinTimer = 0;
  private springSafeTimer = 0;
  private springArcPullTimer = 0;
  private landSquashTimer = 0;
  private invulnTimer = 0;
  private stumbleTimer = 0;
  private combo = 1;
  private comboTimer = 0;
  private crashTimer = 0;
  private runAnimPhase = 0;
  private cameraShake = 0;

  // Powerups
  private magnetTimer = 0;
  private flashlightTimer = 0;
  private turboTimer = 0;
  private wingsTimer = 0;
  private nextFlightCoinZ = -24;
  private hasShield = false;

  // Spawners
  private nextSpawnZ = -42;
  private nextTrafficWaveZ = -90;
  private dialogueTimer = 5.0;
  private lastDialogueId = '';
  private hudThrottle = 0;

  private frameId = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialSkin: SkinId,
    highScore: number,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.currentSkinId = initialSkin;
    this.highScore = highScore;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const z0 = ZONES[0];
    this.scene.background = new THREE.Color(z0.skyColor);
    this.scene.fog = new THREE.Fog(z0.fogColor, 88, 230);

    const aspect = width / Math.max(height, 1);
    const fov = aspect < 0.85 ? 54 : 45;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.4, 250);
    this.camera.position.set(0, 4.9, 8.0);
    this.camera.lookAt(0, 1.4, -14);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envMapTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    this.scene.environment = this.envMapTexture;
    pmremGenerator.dispose();

    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createCityTextures(this.maxAniso);

    this.setupLighting();
    this.buildSkyAndMoon();
    this.buildBiomeParticles();
    this.buildBiomeGrounds();
    this.buildCityStreet();
    this.buildPedestal();
    this.buildPlayer(this.currentSkinId);
    this.buildBroom();
    this.buildParticlePool();
    this.buildJetExhaustPool();
    this.setGraphicsQuality(this.graphicsQuality);
    this.prewarmAllBiomeAssets();

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );

    this.emitHud();
    this.startLoop();
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffedd5, 1.38);
    this.dirLight.position.set(10, 18, 10);
    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(512, 512);
      this.dirLight.shadow.camera.near = 1;
      this.dirLight.shadow.camera.far = 36;
      const d = 11;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    this.headlamp = new THREE.SpotLight(0xfef08a, 0, 52, Math.PI / 4, 0.45, 1.0);
    this.headlamp.position.set(0, 2.2, 0);
    this.headlamp.visible = false;
    this.headlampTarget = new THREE.Object3D();
    this.headlampTarget.position.set(0, 0.4, -22);
    this.scene.add(this.headlamp);
    this.scene.add(this.headlampTarget);
    this.headlamp.target = this.headlampTarget;

    // Dedicated studio key & rim light for crisp 3D character clarity on Home & Shop
    this.menuKeyLight = new THREE.PointLight(0xfff7ed, 2.6, 18, 1.2);
    this.menuKeyLight.position.set(2.4, 3.6, 3.8);
    this.scene.add(this.menuKeyLight);

    this.menuRimLight = new THREE.PointLight(0x38bdf8, 2.2, 16, 1.2);
    this.menuRimLight.position.set(-2.6, 2.8, -2.4);
    this.scene.add(this.menuRimLight);
  }

  private buildSkyAndMoon(): void {
    this.moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7, fog: false }),
    );
    this.moonMesh.position.set(22, 34, -175);
    this.scene.add(this.moonMesh);

    const starCount = 160;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 240;
      starPos[i * 3 + 1] = 22 + Math.random() * 65;
      starPos[i * 3 + 2] = -60 - Math.random() * 140;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsPoints = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.65, fog: false }),
    );
    this.scene.add(this.starsPoints);
  }

  private buildBiomeParticles(): void {
    const count = 90;
    this.biomeParticlePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.biomeParticlePositions[i * 3] = (Math.random() - 0.5) * 28;
      this.biomeParticlePositions[i * 3 + 1] = 0.5 + Math.random() * 13;
      this.biomeParticlePositions[i * 3 + 2] = -4 - Math.random() * 68;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.biomeParticlePositions, 3),
    );
    this.biomeParticleMat = new THREE.PointsMaterial({
      color: 0xf0f9ff,
      map: this.textures.snowFlakeTexture,
      size: 0.42,
      transparent: true,
      opacity: 0.85,
      alphaTest: 0.01,
      depthWrite: false,
    });
    this.biomeParticles = new THREE.Points(geo, this.biomeParticleMat);
    this.biomeParticles.frustumCulled = false;
    this.biomeParticles.visible = false;
    this.scene.add(this.biomeParticles);

    // Realistic 2-layer "lapa lapa" crystal snowfall for Buzul Dünyası (trimmed for crisp fill-rate)
    const nearCount = 100;
    this.snowNearPositions = new Float32Array(nearCount * 3);
    for (let i = 0; i < nearCount; i++) {
      this.snowNearPositions[i * 3] = (Math.random() - 0.5) * 28;
      this.snowNearPositions[i * 3 + 1] = Math.random() * 14.5;
      this.snowNearPositions[i * 3 + 2] = 7.5 - Math.random() * 64;
    }
    const nearGeo = new THREE.BufferGeometry();
    nearGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.snowNearPositions, 3),
    );
    this.snowNearPoints = new THREE.Points(
      nearGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        map: this.textures.snowFlakeTexture,
        size: 0.58,
        transparent: true,
        opacity: 0.94,
        alphaTest: 0.12,
        depthWrite: false,
      }),
    );
    this.snowNearPoints.frustumCulled = false;
    this.snowNearPoints.visible = false;
    this.scene.add(this.snowNearPoints);

    const farCount = 160;
    this.snowFarPositions = new Float32Array(farCount * 3);
    for (let i = 0; i < farCount; i++) {
      this.snowFarPositions[i * 3] = (Math.random() - 0.5) * 48;
      this.snowFarPositions[i * 3 + 1] = Math.random() * 18;
      this.snowFarPositions[i * 3 + 2] = 5 - Math.random() * 100;
    }
    const farGeo = new THREE.BufferGeometry();
    farGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.snowFarPositions, 3),
    );
    this.snowFarPoints = new THREE.Points(
      farGeo,
      new THREE.PointsMaterial({
        color: 0xe0f2fe,
        map: this.textures.snowFlakeTexture,
        size: 0.36,
        transparent: true,
        opacity: 0.85,
        alphaTest: 0.12,
        depthWrite: false,
      }),
    );
    this.snowFarPoints.frustumCulled = false;
    this.snowFarPoints.visible = false;
    this.scene.add(this.snowFarPoints);
  }

  private updateBiomeParticles(
    dt: number,
    zoneId: ZoneId,
    dz: number,
    t: number,
    floorY: number,
  ): void {
    const isSnowWorld = zoneId === 'buzul_dunyasi';
    const particleRatio = QUALITY_PROFILES[this.graphicsQuality].particleRatio;
    this.snowNearPoints.visible = isSnowWorld;
    this.snowFarPoints.visible = isSnowWorld && this.graphicsQuality !== 'low';

    if (isSnowWorld) {
      this.biomeParticles.visible = false;
      const windGust = -1.25 + Math.sin(t * 0.65) * 0.9;

      const nearPos = this.snowNearPositions;
      const nearTotal = nearPos.length / 3;
      const nearCount = Math.floor(nearTotal * particleRatio);
      for (let i = 0; i < nearCount; i++) {
        const idx = i * 3;
        nearPos[idx] += (windGust + Math.sin(t * 2.1 + i * 0.73) * 1.45) * dt;
        nearPos[idx + 1] -= (3.3 + (i % 5) * 0.42) * dt;
        nearPos[idx + 2] += dz * 0.72;
        if (nearPos[idx] < -14) nearPos[idx] += 28;
        else if (nearPos[idx] > 14) nearPos[idx] -= 28;
        if (nearPos[idx + 1] < 0.05) {
          nearPos[idx + 1] = 13.8 + Math.random() * 1.2;
          nearPos[idx] = (Math.random() - 0.5) * 28;
        }
        if (nearPos[idx + 2] > 7.5) {
          nearPos[idx + 2] = -56 - Math.random() * 4;
        }
      }
      (
        this.snowNearPoints.geometry.getAttribute('position') as THREE.BufferAttribute
      ).needsUpdate = true;

      const farPos = this.snowFarPositions;
      const farTotal = farPos.length / 3;
      const farCount =
        this.graphicsQuality === 'low' ? 0 : Math.floor(farTotal * particleRatio);
      for (let i = 0; i < farCount; i++) {
        const idx = i * 3;
        farPos[idx] += (windGust * 0.8 + Math.cos(t * 1.5 + i * 0.51) * 0.95) * dt;
        farPos[idx + 1] -= (2.5 + (i % 4) * 0.35) * dt;
        farPos[idx + 2] += dz * 0.92;
        if (farPos[idx] < -24) farPos[idx] += 48;
        else if (farPos[idx] > 24) farPos[idx] -= 48;
        if (farPos[idx + 1] < 0.05) {
          farPos[idx + 1] = 16.5 + Math.random() * 2;
          farPos[idx] = (Math.random() - 0.5) * 48;
        }
        if (farPos[idx + 2] > 5) {
          farPos[idx + 2] = -95 - Math.random() * 5;
        }
      }
      (
        this.snowFarPoints.geometry.getAttribute('position') as THREE.BufferAttribute
      ).needsUpdate = true;
      return;
    }

    if (zoneId === 'mahalle_caddesi') {
      this.biomeParticles.visible = false;
      return;
    }
    this.biomeParticles.visible = true;
    const pos = this.biomeParticlePositions;
    const bioRatio = QUALITY_PROFILES[this.graphicsQuality].particleRatio;
    const count = Math.floor((pos.length / 3) * bioRatio);

    if (zoneId === 'ates_diyari') {
      this.biomeParticleMat.color.setHex(0xfb923c);
      this.biomeParticleMat.size = 0.32;
      this.biomeParticleMat.opacity = 0.92;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += Math.cos(t * 3 + i) * 0.9 * dt;
        pos[idx + 1] += 4.6 * dt;
        pos[idx + 2] += dz * 0.75;
        if (pos[idx + 1] > 14 || pos[idx + 1] < 0) pos[idx + 1] = 0.2;
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    } else if (zoneId === 'dev_mutfak') {
      this.biomeParticleMat.color.setHex(0xfef08a);
      this.biomeParticleMat.size = 0.24;
      this.biomeParticleMat.opacity = 0.75;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += Math.sin(t * 1.8 + i) * 0.65 * dt;
        pos[idx + 1] -= 1.3 * dt;
        pos[idx + 2] += dz * 0.8;
        if (pos[idx + 1] < 0.3 || pos[idx + 1] > 13.5) pos[idx + 1] = 13.0;
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    } else if (zoneId === 'kopuklu_banyo') {
      this.biomeParticleMat.color.setHex(0xa5f3fc);
      this.biomeParticleMat.size = 0.42;
      this.biomeParticleMat.opacity = 0.78;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += Math.sin(t * 2.2 + i) * 1.1 * dt;
        pos[idx + 1] += 2.6 * dt;
        pos[idx + 2] += dz * 0.75;
        if (pos[idx + 1] > 13.5 || pos[idx + 1] < 0.2) pos[idx + 1] = 0.4;
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    } else if (zoneId === 'cilgin_lab') {
      this.biomeParticleMat.color.setHex(0x4ade80);
      this.biomeParticleMat.size = 0.28;
      this.biomeParticleMat.opacity = 0.88;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += Math.cos(t * 2.5 + i) * 0.7 * dt;
        pos[idx + 1] += 3.2 * dt;
        pos[idx + 2] += dz * 0.78;
        if (pos[idx + 1] > 13.5 || pos[idx + 1] < 0.2) pos[idx + 1] = 0.3;
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    } else if (zoneId === 'peynir_galaksisi') {
      this.biomeParticleMat.color.setHex(0xf0abfc);
      this.biomeParticleMat.size = 0.3;
      this.biomeParticleMat.opacity = 0.92;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += Math.sin(t * 1.2 + i) * 0.45 * dt;
        pos[idx + 1] += Math.cos(t * 1.4 + i) * 0.45 * dt;
        pos[idx + 2] += dz * 1.15;
        if (pos[idx + 1] < 0.4 || pos[idx + 1] > 14) pos[idx + 1] = 2 + (i % 10);
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    } else {
      // yeralti_magarasi -> golden cave dust floating inside the -4.2m earth tunnel
      this.biomeParticleMat.color.setHex(0xfbbf24);
      this.biomeParticleMat.size = 0.22;
      this.biomeParticleMat.opacity = 0.7;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] = THREE.MathUtils.clamp(pos[idx], -5.8, 5.8);
        if (pos[idx + 1] < floorY + 0.3 || pos[idx + 1] > floorY + 8.5) {
          pos[idx + 1] = floorY + 0.6 + Math.random() * 7.2;
        }
        pos[idx + 1] += Math.sin(t * 1.5 + i) * 0.35 * dt;
        pos[idx + 2] += dz * 0.7;
        if (pos[idx + 2] > 4) pos[idx + 2] = -70;
      }
    }
    const attr = this.biomeParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  private buildBiomeGrounds(): void {
    // Physical 3D Tunnel Entrance Descent & Exit Staircase meshes (positioned at active Yeraltı stage boundaries)
    this.descentTunnelMesh = createTunnelDescentModel(
      this.textures.earthRoadTexture,
      this.textures.earthWallTexture,
    );
    this.descentTunnelMesh.visible = false;
    this.scene.add(this.descentTunnelMesh);

    this.staircaseExitMesh = createTunnelStaircaseExitModel(
      this.textures.earthWallTexture,
    );
    this.staircaseExitMesh.visible = false;
    this.scene.add(this.staircaseExitMesh);

    // Persistent Biome Transition Gate & Record Gate (zero mid-run allocations or shader compiles!)
    this.transitionGateMesh = createBiomeTransitionGateModel(
      ZONES[1].lampColor,
      ZONES[1].buildingTint,
    );
    this.transitionGateMesh.visible = false;
    this.scene.add(this.transitionGateMesh);

    this.recordGateMesh = createRecordGateModel();
    this.recordGateMesh.visible = false;
    this.scene.add(this.recordGateMesh);
  }

  private prewarmAllBiomeAssets(): void {
    const obstacleTemplates: [string, () => THREE.Group][] = [
      ['taxi', createTaxiModel],
      ['moving_taxi', createMovingTaxiModel],
      ['bus_ramp', createCityBusWithRampModel],
      ['terrain_ramp_yeralti_magarasi', createEarthRampModel],
      ['terrain_ramp_buzul_dunyasi', createIceRampModel],
      ['terrain_ramp_ates_diyari', createLavaRampModel],
      ['terrain_ramp_dev_mutfak', createKitchenRampModel],
      ['terrain_ramp_kopuklu_banyo', createBathRampModel],
      ['terrain_ramp_cilgin_lab', createLabRampModel],
      ['terrain_ramp_peynir_galaksisi', createSpaceRampModel],
      ['spring_pad', createSpringPadModel],
      ['dumpster', createDumpsterModel],
      ['cone', createConeBarrierModel],
      ['tire', createTireModel],
      ['road_sign', createRoadSignHighModel],
      ['phone_roach_0', () => createPhoneRoachObstacle(SKINS[0], this.textures.chitinWingTexture, this.textures.fabricWeaveTexture)],
      ['phone_roach_2', () => createPhoneRoachObstacle(SKINS[2], this.textures.chitinWingTexture, this.textures.fabricWeaveTexture)],
      ['mine_cart', createMineCartModel],
      ['earth_boulder', createEarthBoulderModel],
      ['root_arch', createRootArchModel],
      ['mushroom_cluster', createMushroomClusterModel],
      ['ice_wall', createIceWallModel],
      ['ice_crystal', createIceCrystalModel],
      ['icicle_arch', createIcicleArchModel],
      ['snow_ball', createSnowBallModel],
      ['lava_rock', createLavaRockModel],
      ['fire_pillar', createFirePillarModel],
      ['magma_arch', createMagmaArchModel],
      ['fire_barrel', createFireBarrelModel],
      ['rolling_pin', createRollingPinModel],
      ['butter_block', createButterBlockModel],
      ['toaster_arch', createToasterArchModel],
      ['tomato_ball', createTomatoBallModel],
      ['giant_slipper', createGiantSlipperModel],
      ['soap_bar', createSoapBarModel],
      ['towel_arch', createTowelArchModel],
      ['tp_roll', createTpRollModel],
      ['raid_can', createRaidCanModel],
      ['beaker_vat', createBeakerVatModel],
      ['laser_arch', createLaserArchModel],
      ['jelly_cube', createJellyCubeModel],
      ['ufo_saucer', createUfoSaucerModel],
      ['cheese_asteroid', createCheeseAsteroidModel],
      ['warp_arch', createWarpArchModel],
      ['space_meteor', createSpaceMeteorModel],
    ];

    const powerupTypes: PowerupType[] = ['magnet', 'shield', 'flashlight', 'turbo', 'wings'];
    const tempObstacles: [string, THREE.Group][] = [];
    const tempPowerups: [PowerupType, THREE.Group][] = [];
    const tempCoins: THREE.Group[] = [];

    const extraCopiesKeys = new Set([
      'taxi',
      'cone',
      'dumpster',
      'tire',
      'phone_roach_0',
      'phone_roach_2',
      'mine_cart',
      'earth_boulder',
      'ice_wall',
      'ice_crystal',
      'lava_rock',
      'fire_pillar',
      'rolling_pin',
      'butter_block',
      'giant_slipper',
      'soap_bar',
      'raid_can',
      'beaker_vat',
      'ufo_saucer',
      'cheese_asteroid',
    ]);

    for (const [key, factory] of obstacleTemplates) {
      const copies = extraCopiesKeys.has(key) ? 2 : 1;
      for (let i = 0; i < copies; i++) {
        const mesh = factory();
        if (i === 0) {
          mesh.position.set(0, 0, -24);
          this.scene.add(mesh);
        }
        tempObstacles.push([key, mesh]);
      }
    }
    for (const pType of powerupTypes) {
      for (let i = 0; i < 2; i++) {
        const mesh = createPowerupModel(pType);
        if (i === 0) {
          mesh.position.set(0, 1, -24);
          this.scene.add(mesh);
        }
        tempPowerups.push([pType, mesh]);
      }
    }
    for (let c = 0; c < 32; c++) {
      const coinMesh = createSimitCoinModel();
      if (c === 0) {
        coinMesh.position.set(0, 1, -22);
        this.scene.add(coinMesh);
      }
      tempCoins.push(coinMesh);
    }

    if (!this.isSoftwareGl) {
      for (const seg of this.segments) {
        seg.group.visible = true;
        (Object.keys(seg.biomeGroups) as ZoneId[]).forEach((k) => {
          seg.biomeGroups[k].visible = true;
        });
        seg.skywayGroup.visible = true;
      }
      this.descentTunnelMesh.visible = true;
      this.staircaseExitMesh.visible = true;
      this.transitionGateMesh.visible = true;
      this.recordGateMesh.visible = true;
      this.broomMesh.visible = true;
      this.biomeParticles.visible = true;
      this.snowNearPoints.visible = true;
      this.snowFarPoints.visible = true;
      this.playerRig.jetpackGroup.visible = true;
      this.playerRig.shieldSphere.visible = true;
      this.playerRig.headlampMesh.visible = true;
      this.particleInstancedMesh.visible = true;
      this.jetExhaustInstancedMesh.visible = true;
      _mat4A.compose(_vec3A.set(0, 1, -20), _quatA.identity(), _vec3B.set(0.05, 0.05, 0.05));
      this.particleInstancedMesh.setMatrixAt(0, _mat4A);
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
      this.jetExhaustInstancedMesh.setMatrixAt(0, _mat4A);
      this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;

      const prevKeyVis = this.menuKeyLight.visible;
      const prevRimVis = this.menuRimLight.visible;
      const prevLampVis = this.headlamp.visible;
      const prevLampIntensity = this.headlamp.intensity;

      // 1) Prewarm Menu lighting state
      this.menuKeyLight.visible = true;
      this.menuRimLight.visible = true;
      this.headlamp.visible = false;
      this.headlamp.intensity = 0;
      this.renderer.compile(this.scene, this.camera);

      // 2) Prewarm Daytime Gameplay lighting state (0 point lights, 0 spot lights)
      this.menuKeyLight.visible = false;
      this.menuRimLight.visible = false;
      this.headlamp.visible = false;
      this.renderer.compile(this.scene, this.camera);

      // 3) Prewarm Underground / Flashlight Gameplay lighting state (0 point lights, 1 spot light)
      this.headlamp.visible = true;
      this.headlamp.intensity = 1;
      this.renderer.compile(this.scene, this.camera);

      // Restore initial Menu lighting & hide temporary prewarm meshes
      this.menuKeyLight.visible = prevKeyVis;
      this.menuRimLight.visible = prevRimVis;
      this.headlamp.visible = prevLampVis;
      this.headlamp.intensity = prevLampIntensity;

      _mat4A.compose(_vec3A.set(0, -50, 0), _quatA.identity(), _zeroScale);
      this.particleInstancedMesh.setMatrixAt(0, _mat4A);
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
      this.particleInstancedMesh.visible = false;
      this.jetExhaustInstancedMesh.setMatrixAt(0, _mat4A);
      this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;
      this.jetExhaustInstancedMesh.visible = false;

      this.descentTunnelMesh.visible = false;
      this.staircaseExitMesh.visible = false;
      this.transitionGateMesh.visible = false;
      this.recordGateMesh.visible = false;
      this.broomMesh.visible = false;
      this.biomeParticles.visible = false;
      this.snowNearPoints.visible = false;
      this.snowFarPoints.visible = false;
      this.playerRig.jetpackGroup.visible = false;
      this.playerRig.shieldSphere.visible = false;
      this.playerRig.headlampMesh.visible = false;
      for (const seg of this.segments) {
        (Object.keys(seg.biomeGroups) as ZoneId[]).forEach((k) => {
          seg.biomeGroups[k].visible = k === 'mahalle_caddesi';
        });
        seg.activeBiomeGroup = seg.biomeGroups.mahalle_caddesi;
        seg.activeZoneId = 'mahalle_caddesi';
        seg.skywayGroup.visible = false;
      }
      this.applyZoneVisuals(ZONES[0], true);
    }

    for (const [key, mesh] of tempObstacles) {
      if (mesh.parent === this.scene) this.scene.remove(mesh);
      let bucket = this.obstaclePool.get(key);
      if (!bucket) {
        bucket = [];
        this.obstaclePool.set(key, bucket);
      }
      bucket.push(mesh);
    }
    for (const [pType, mesh] of tempPowerups) {
      if (mesh.parent === this.scene) this.scene.remove(mesh);
      let bucket = this.powerupPool.get(pType);
      if (!bucket) {
        bucket = [];
        this.powerupPool.set(pType, bucket);
      }
      bucket.push(mesh);
    }
    for (const coinMesh of tempCoins) {
      if (coinMesh.parent === this.scene) this.scene.remove(coinMesh);
      this.coinPool.push(coinMesh);
    }
  }

  private buildCityStreet(): void {
    const signGeo = new THREE.PlaneGeometry(4.2, 1.6);
    const awningGeo = new THREE.BoxGeometry(1.4, 0.35, SEGMENT_LENGTH * 0.68);
    const awningColors = [0xdc2626, 0x059669, 0xd97706, 0x2563eb];
    const awningMats = awningColors.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }),
    );
    const shopSignMats = this.textures.shopSigns.map(
      (signTex) =>
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: 0xffffff,
          emissiveMap: signTex,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        }),
    );
    const cityBuildingMat = new THREE.MeshStandardMaterial({
      map: this.textures.buildingTexture,
      color: ZONES[0].buildingTint,
      roughness: 0.78,
    });

    // Shared 20m road + flank geometries/materials per biome for seamless infinite cycling
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LENGTH);
    const roadMats: Record<ZoneId, THREE.Material> = {
      mahalle_caddesi: new THREE.MeshStandardMaterial({
        map: this.textures.asphaltTexture,
        roughness: 0.72,
        metalness: 0.08,
      }),
      yeralti_magarasi: new THREE.MeshStandardMaterial({
        map: this.textures.earthRoadTexture,
        roughness: 0.94,
      }),
      buzul_dunyasi: new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        roughness: 0.1,
        metalness: 0.18,
      }),
      ates_diyari: new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.72,
        metalness: 0.25,
      }),
      dev_mutfak: new THREE.MeshStandardMaterial({
        map: this.textures.kitchenRoadTexture,
        roughness: 0.32,
        metalness: 0.06,
      }),
      kopuklu_banyo: new THREE.MeshStandardMaterial({
        map: this.textures.bathRoadTexture,
        roughness: 0.14,
        metalness: 0.1,
      }),
      cilgin_lab: new THREE.MeshStandardMaterial({
        map: this.textures.labRoadTexture,
        roughness: 0.35,
        metalness: 0.52,
      }),
      peynir_galaksisi: new THREE.MeshStandardMaterial({
        map: this.textures.spaceRoadTexture,
        roughness: 0.38,
        metalness: 0.28,
      }),
    };

    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: this.textures.sidewalkTexture,
      roughness: 0.82,
    });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const earthBankMat = new THREE.MeshStandardMaterial({
      map: this.textures.earthWallTexture,
      color: 0x85583a,
      roughness: 0.96,
    });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.82 });
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.32,
      metalness: 0.55,
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const counterFlankMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4 });
    const bathFlankMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.35 });
    const labAcidMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const spaceFlankMat = new THREE.MeshStandardMaterial({ color: 0x0f0b2e, roughness: 0.75 });

    const sidewalkGeo = new THREE.BoxGeometry(5.2, 0.22, SEGMENT_LENGTH);
    const curbGeo = new THREE.BoxGeometry(0.28, 0.26, SEGMENT_LENGTH);
    const emberGeo = new THREE.BoxGeometry(0.1, 0.08, SEGMENT_LENGTH);
    const wideFlankBoxGeo = new THREE.BoxGeometry(22, 0.36, SEGMENT_LENGTH);
    const wideLiquidPlaneGeo = new THREE.PlaneGeometry(28, SEGMENT_LENGTH);
    const bldgGeos = [0, 1, 2, 3].map(
      (hIdx) => new THREE.BoxGeometry(7.2, 14 + hIdx * 3.5, SEGMENT_LENGTH - 0.6),
    );

    this.sharedDisposables.push(
      signGeo,
      awningGeo,
      cityBuildingMat,
      roadGeo,
      sidewalkMat,
      curbMat,
      earthBankMat,
      snowMat,
      obsidianMat,
      emberMat,
      lavaMat,
      counterFlankMat,
      bathFlankMat,
      labAcidMat,
      spaceFlankMat,
      sidewalkGeo,
      curbGeo,
      emberGeo,
      wideFlankBoxGeo,
      wideLiquidPlaneGeo,
      ...awningMats,
      ...shopSignMats,
      ...Object.values(roadMats),
      ...bldgGeos,
    );

    const markShared = (mesh: THREE.Mesh, sharedGeo = true) => {
      mesh.userData.sharedMaterial = true;
      if (sharedGeo) mesh.userData.sharedGeometry = true;
      return mesh;
    };

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const group = new THREE.Group();
      group.position.z = -i * SEGMENT_LENGTH;

      const addGroundTo = (target: THREE.Group, zoneId: ZoneId) => {
        const road = markShared(new THREE.Mesh(roadGeo, roadMats[zoneId]));
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        target.add(road);

        [-1, 1].forEach((side) => {
          if (zoneId === 'mahalle_caddesi') {
            const sw = markShared(new THREE.Mesh(sidewalkGeo, sidewalkMat));
            sw.position.set(side * 6.64, 0.11, 0);
            sw.receiveShadow = true;
            target.add(sw);
            const curb = markShared(new THREE.Mesh(curbGeo, curbMat));
            curb.position.set(side * 4.04, 0.13, 0);
            target.add(curb);
          } else if (zoneId === 'yeralti_magarasi') {
            const bank = markShared(new THREE.Mesh(wideFlankBoxGeo, earthBankMat));
            bank.position.set(side * 14.9, 0.14, 0);
            target.add(bank);
          } else if (zoneId === 'buzul_dunyasi') {
            const snowBank = markShared(new THREE.Mesh(wideFlankBoxGeo, snowMat));
            snowBank.position.set(side * 15.0, 0.15, 0);
            snowBank.receiveShadow = true;
            target.add(snowBank);
          } else if (zoneId === 'ates_diyari') {
            const curb = markShared(new THREE.Mesh(curbGeo, obsidianMat));
            curb.position.set(side * 4.0, 0.17, 0);
            target.add(curb);
            const ember = markShared(new THREE.Mesh(emberGeo, emberMat));
            ember.position.set(side * 4.0, 0.35, 0);
            target.add(ember);
            const lava = markShared(new THREE.Mesh(wideLiquidPlaneGeo, lavaMat));
            lava.rotation.x = -Math.PI / 2;
            lava.position.set(side * 18.0, -0.75, 0);
            target.add(lava);
          } else if (zoneId === 'dev_mutfak') {
            const deck = markShared(new THREE.Mesh(wideFlankBoxGeo, counterFlankMat));
            deck.position.set(side * 15.0, 0.1, 0);
            deck.receiveShadow = true;
            target.add(deck);
          } else if (zoneId === 'kopuklu_banyo') {
            const deck = markShared(new THREE.Mesh(wideFlankBoxGeo, bathFlankMat));
            deck.position.set(side * 15.0, 0.08, 0);
            deck.receiveShadow = true;
            target.add(deck);
          } else if (zoneId === 'cilgin_lab') {
            const curb = markShared(new THREE.Mesh(curbGeo, obsidianMat));
            curb.position.set(side * 4.05, 0.14, 0);
            target.add(curb);
            const acid = markShared(new THREE.Mesh(wideLiquidPlaneGeo, labAcidMat));
            acid.rotation.x = -Math.PI / 2;
            acid.position.set(side * 18.0, -0.55, 0);
            target.add(acid);
          } else {
            const voidSide = markShared(new THREE.Mesh(wideLiquidPlaneGeo, spaceFlankMat));
            voidSide.rotation.x = -Math.PI / 2;
            voidSide.position.set(side * 18.0, -0.9, 0);
            target.add(voidSide);
          }
        });
      };

      // 1. City Street Group
      const cityGroup = new THREE.Group();
      addGroundTo(cityGroup, 'mahalle_caddesi');

      [-1, 1].forEach((side, bIdx) => {
        const hIdx = (i * 3 + bIdx * 5) % 4;
        const height = 14 + hIdx * 3.5;
        const bldg = markShared(new THREE.Mesh(bldgGeos[hIdx], cityBuildingMat));
        bldg.position.set(side * 11.1, height / 2, 0);
        bldg.receiveShadow = true;
        cityGroup.add(bldg);

        const awning = markShared(
          new THREE.Mesh(awningGeo, awningMats[(i + bIdx) % awningMats.length]),
        );
        awning.position.set(side * 7.2, 3.1, 0);
        cityGroup.add(awning);

        const shopSign = markShared(
          new THREE.Mesh(signGeo, shopSignMats[(i * 2 + bIdx) % shopSignMats.length]),
        );
        shopSign.position.set(side * 7.42, 4.15, 0);
        shopSign.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        cityGroup.add(shopSign);
      });

      const lampSide = i % 2 === 0 ? -1 : 1;
      const lamp = createStreetLampModel();
      lamp.position.set(lampSide * 4.55, 0.22, -4);
      if (lampSide === 1) lamp.rotation.y = Math.PI;
      cityGroup.add(lamp);

      const tree = createCityTreeModel();
      tree.position.set(-lampSide * 5.0, 0.22, 4);
      cityGroup.add(tree);

      const spectators: THREE.Group[] = [];
      const skipObjects = new Set<THREE.Object3D>();
      if (i > 0 && i % 2 === 1) {
        const side = i % 4 === 1 ? -1 : 1;
        const specSkin = SKINS[(i + 1) % SKINS.length];
        const specRoot = createSpectatorCockroachModel(
          specSkin,
          this.textures.chitinWingTexture,
          this.textures.fabricWeaveTexture,
        );
        specRoot.scale.setScalar(0.68);
        specRoot.position.set(side * 5.05, 0.22, -1.5);
        specRoot.rotation.y = side === -1 ? -Math.PI / 2.2 : Math.PI / 2.2;
        cityGroup.add(specRoot);
        spectators.push(specRoot);
        skipObjects.add(specRoot);
      }

      if (i % 4 === 2) {
        const arch = createStreetArchModel();
        cityGroup.add(arch);
      }
      bakeStaticGroup(cityGroup, {
        castShadow: false,
        receiveShadow: false,
        keepTransparent: true,
        keepTextured: true,
        skipObjects,
      });
      group.add(cityGroup);

      const earthGroup = createEarthCavernSegmentProps(i, this.textures.earthWallTexture);
      addGroundTo(earthGroup, 'yeralti_magarasi');
      earthGroup.visible = false;
      group.add(earthGroup);

      const iceGroup = createIceWorldSegmentProps(i);
      addGroundTo(iceGroup, 'buzul_dunyasi');
      iceGroup.visible = false;
      group.add(iceGroup);

      const fireGroup = createFireWorldSegmentProps(i);
      addGroundTo(fireGroup, 'ates_diyari');
      fireGroup.visible = false;
      group.add(fireGroup);

      const kitchenGroup = createKitchenSegmentProps(i);
      addGroundTo(kitchenGroup, 'dev_mutfak');
      kitchenGroup.visible = false;
      group.add(kitchenGroup);

      const bathGroup = createBathSegmentProps(i);
      addGroundTo(bathGroup, 'kopuklu_banyo');
      bathGroup.visible = false;
      group.add(bathGroup);

      const labGroup = createLabSegmentProps(i);
      addGroundTo(labGroup, 'cilgin_lab');
      labGroup.visible = false;
      group.add(labGroup);

      const spaceGroup = createSpaceSegmentProps(i);
      addGroundTo(spaceGroup, 'peynir_galaksisi');
      spaceGroup.visible = false;
      group.add(spaceGroup);

      const skywayGroup = createSkywaySegmentModel(i);
      skywayGroup.visible = false;
      group.add(skywayGroup);

      this.scene.add(group);
      this.segments.push({
        group,
        spectators,
        biomeGroups: {
          mahalle_caddesi: cityGroup,
          yeralti_magarasi: earthGroup,
          buzul_dunyasi: iceGroup,
          ates_diyari: fireGroup,
          dev_mutfak: kitchenGroup,
          kopuklu_banyo: bathGroup,
          cilgin_lab: labGroup,
          peynir_galaksisi: spaceGroup,
        },
        activeBiomeGroup: cityGroup,
        activeZoneId: 'mahalle_caddesi',
        skywayGroup,
        biomeVisible: true,
      });
    }
  }

  private applySegmentEnvironment(
    seg: StreetSegment,
    zoneId: ZoneId,
    forceSync = false,
  ): void {
    if (forceSync) {
      (Object.keys(seg.biomeGroups) as ZoneId[]).forEach((k) => {
        seg.biomeGroups[k].visible = k === zoneId;
      });
      seg.activeBiomeGroup = seg.biomeGroups[zoneId];
      seg.activeZoneId = zoneId;
    } else if (seg.activeZoneId !== zoneId) {
      seg.activeBiomeGroup.visible = false;
      seg.activeBiomeGroup = seg.biomeGroups[zoneId];
      seg.activeBiomeGroup.visible = true;
      seg.activeZoneId = zoneId;
    }
    seg.skywayGroup.visible = this.wingsTimer > 0 && zoneId !== 'yeralti_magarasi';
  }

  private buildPlayer(skinId: SkinId): void {
    if (this.playerRig) this.removeAndDispose(this.playerRig.root);
    if (this.playerShadow) this.removeAndDispose(this.playerShadow);

    const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
    this.playerRig = createCockroachModel(
      skin,
      this.textures.chitinWingTexture,
      this.textures.fabricWeaveTexture,
    );
    this.playerRig.root.position.set(0, 0, 0);
    this.scene.add(this.playerRig.root);

    this.playerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.75),
      new THREE.MeshBasicMaterial({
        map: this.textures.shadowTexture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, 0.02, 0);
    this.scene.add(this.playerShadow);
  }

  private buildPedestal(): void {
    this.pedestalGroup = createShowcasePedestal();
    this.pedestalGroup.position.set(0, 0, MENU_SHOWCASE_Z);
    this.scene.add(this.pedestalGroup);
  }

  private buildBroom(): void {
    this.broomMesh = createBroomModel();
    this.broomMesh.position.set(8, 0, 1.5);
    this.broomMesh.visible = false;
    this.scene.add(this.broomMesh);
  }

  private buildParticlePool(): void {
    const count = 36;
    const geo = new THREE.OctahedronGeometry(0.11, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.particleInstancedMesh = new THREE.InstancedMesh(geo, mat, count);
    this.particleInstancedMesh.frustumCulled = false;
    this.particleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    _mat4A.compose(_vec3A.set(0, -50, 0), _quatA.identity(), _zeroScale);
    _colorA.setHex(0xfbbf24);
    for (let i = 0; i < count; i++) {
      this.particleInstancedMesh.setMatrixAt(i, _mat4A);
      this.particleInstancedMesh.setColorAt(i, _colorA);
      this.particles.push({
        x: 0,
        y: -50,
        z: 0,
        rx: 0,
        ry: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: _colorA.r,
        g: _colorA.g,
        b: _colorA.b,
        life: 0,
        maxLife: 0.35,
      });
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.particleInstancedMesh.instanceColor) {
      this.particleInstancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.particleInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.particleInstancedMesh.visible = false;
    this.scene.add(this.particleInstancedMesh);
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number,
    spread = 3.2,
  ): void {
    const scaledCount = Math.max(
      1,
      Math.round(count * QUALITY_PROFILES[this.graphicsQuality].burstMultiplier),
    );
    _colorA.setHex(colorHex);
    for (let i = 0; i < scaledCount; i++) {
      const idx = this.particleCursor;
      const p = this.particles[idx];
      this.particleCursor = (idx + 1) % this.particles.length;
      p.x = x;
      p.y = y;
      p.z = z;
      p.rx = 0;
      p.ry = 0;
      p.vx = (Math.random() - 0.5) * spread * 2;
      p.vy = 1.4 + Math.random() * spread;
      p.vz = (Math.random() - 0.5) * spread * 1.4;
      p.r = _colorA.r;
      p.g = _colorA.g;
      p.b = _colorA.b;
      p.maxLife = 0.28 + Math.random() * 0.18;
      p.life = p.maxLife;
      this.particleInstancedMesh.setColorAt(idx, _colorA);
      _mat4A.compose(_vec3A.set(x, y, z), _quatA.identity(), _vec3B.set(1, 1, 1));
      this.particleInstancedMesh.setMatrixAt(idx, _mat4A);
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.particleInstancedMesh.instanceColor) {
      this.particleInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.particleInstancedMesh.visible = true;
  }

  private updateParticles(dt: number): void {
    if (!this.particleInstancedMesh.visible) return;
    const floorLimit = this.currentGroundY + 0.05;
    let anyAlive = false;
    let dirtyMatrix = false;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        _mat4A.compose(_vec3A.set(0, -50, 0), _quatA.identity(), _zeroScale);
        this.particleInstancedMesh.setMatrixAt(i, _mat4A);
        dirtyMatrix = true;
        continue;
      }
      anyAlive = true;
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(floorLimit, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rx += dt * 8;
      p.ry += dt * 6;
      const ratio = p.life / p.maxLife;
      const s = 0.28 + ratio * 0.9;
      _eulerA.set(p.rx, p.ry, 0);
      _quatA.setFromEuler(_eulerA);
      _mat4A.compose(_vec3A.set(p.x, p.y, p.z), _quatA, _vec3B.set(s, s, s));
      this.particleInstancedMesh.setMatrixAt(i, _mat4A);
      dirtyMatrix = true;
    }

    if (dirtyMatrix) {
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    }
    if (!anyAlive) {
      this.particleInstancedMesh.visible = false;
    }
  }

  private buildJetExhaustPool(): void {
    const count = 120;
    const geo = new THREE.SphereGeometry(0.16, 6, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.jetExhaustInstancedMesh = new THREE.InstancedMesh(geo, mat, count);
    this.jetExhaustInstancedMesh.frustumCulled = false;
    this.jetExhaustInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    _mat4A.compose(_vec3A.set(0, -50, 0), _quatA.identity(), _zeroScale);
    for (let i = 0; i < count; i++) {
      this.jetExhaustInstancedMesh.setMatrixAt(i, _mat4A);
      this.jetExhaustInstancedMesh.setColorAt(i, _jetFireColor);
      this.jetExhaustPool.push({
        x: 0,
        y: -50,
        z: 0,
        rx: 0,
        ry: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: _jetFireColor.r,
        g: _jetFireColor.g,
        b: _jetFireColor.b,
        life: 0,
        maxLife: 0.38,
      });
    }
    this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.jetExhaustInstancedMesh.instanceColor) {
      this.jetExhaustInstancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.jetExhaustInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.jetExhaustInstancedMesh.visible = false;
    this.scene.add(this.jetExhaustInstancedMesh);
  }

  private emitJetExhaust(
    x: number,
    y: number,
    z: number,
    lateralVel: number,
  ): void {
    const idx = this.jetExhaustCursor;
    const p = this.jetExhaustPool[idx];
    this.jetExhaustCursor = (idx + 1) % this.jetExhaustPool.length;
    p.x = x + (Math.random() - 0.5) * 0.08;
    p.y = y + (Math.random() - 0.5) * 0.08;
    p.z = z + (Math.random() - 0.5) * 0.08;
    p.vx = lateralVel * 0.09 + (Math.random() - 0.5) * 0.9;
    p.vy = -2.85 - Math.random() * 1.1;
    p.vz = 5.8 + Math.random() * 2.2;
    p.maxLife = 0.34 + Math.random() * 0.09;
    p.life = p.maxLife;
    const s = 0.75 + Math.random() * 0.2;
    _mat4A.compose(_vec3A.set(p.x, p.y, p.z), _quatA.identity(), _vec3B.set(s, s, s));
    this.jetExhaustInstancedMesh.setMatrixAt(idx, _mat4A);
    this.jetExhaustInstancedMesh.setColorAt(idx, _jetFireColor);
    this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.jetExhaustInstancedMesh.instanceColor) {
      this.jetExhaustInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.jetExhaustInstancedMesh.visible = true;
  }

  private updateJetExhaust(dt: number): void {
    if (!this.jetExhaustInstancedMesh.visible) return;
    let anyAlive = false;
    let dirtyMatrix = false;
    let dirtyColor = false;
    _quatA.identity();

    for (let i = 0; i < this.jetExhaustPool.length; i++) {
      const p = this.jetExhaustPool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        _mat4A.compose(_vec3A.set(0, -50, 0), _quatA, _zeroScale);
        this.jetExhaustInstancedMesh.setMatrixAt(i, _mat4A);
        dirtyMatrix = true;
        continue;
      }
      anyAlive = true;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const progress = 1 - p.life / p.maxLife;
      // Subway Surfers gradient: fiery orange-red -> gold -> neon phosphor lime -> electric cyan!
      if (progress < 0.24) {
        _colorA.copy(_jetFireColor).lerp(_jetGoldColor, progress / 0.24);
      } else if (progress < 0.62) {
        _colorA.copy(_jetGoldColor).lerp(_jetPhosphorColor, (progress - 0.24) / 0.38);
      } else {
        _colorA.copy(_jetPhosphorColor).lerp(_jetCyanColor, (progress - 0.62) / 0.38);
      }
      const fade = progress > 0.72 ? (1 - progress) / 0.28 : 1;
      const s = (0.78 + progress * 0.92) * fade;
      _mat4A.compose(_vec3A.set(p.x, p.y, p.z), _quatA, _vec3B.set(s, s, s));
      this.jetExhaustInstancedMesh.setMatrixAt(i, _mat4A);
      this.jetExhaustInstancedMesh.setColorAt(i, _colorA);
      dirtyMatrix = true;
      dirtyColor = true;
    }

    if (dirtyMatrix) {
      this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;
    }
    if (dirtyColor && this.jetExhaustInstancedMesh.instanceColor) {
      this.jetExhaustInstancedMesh.instanceColor.needsUpdate = true;
    }
    if (!anyAlive) {
      this.jetExhaustInstancedMesh.visible = false;
    }
  }

  // --- Public Controls ---

  public setSkin(skinId: SkinId): void {
    this.currentSkinId = skinId;
    this.buildPlayer(skinId);
  }

  public setHighScore(score: number): void {
    this.highScore = score;
  }

  public setUpgrades(upgrades: Record<UpgradeKey, number>): void {
    this.upgrades = { ...upgrades };
  }

  public setBonusMultiplier(multiplier: number): void {
    this.bonusMultiplier = Math.max(1, multiplier);
  }

  public setShopPreviewMode(open: boolean): void {
    this.shopPreviewOpen = open;
    if (!open) this.menuSpinYaw = 0;
  }

  public rotateMenuCharacter(deltaX: number): void {
    if (this.phase !== 'menu') return;
    this.menuSpinYaw += deltaX * 0.012;
  }

  public isPointOnMenuCharacter(clientX: number, clientY: number): boolean {
    if (this.phase !== 'menu' || this.shopPreviewOpen) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const cx = this.menuShowcaseX;
    const cz = MENU_SHOWCASE_Z;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let xi = -1; xi <= 1; xi += 2) {
      for (let yi = 0; yi <= 1; yi += 1) {
        for (let zi = -1; zi <= 1; zi += 2) {
          _vec3A.set(cx + xi * 1.15, yi === 0 ? -0.25 : 2.8, cz + zi * 0.9);
          _vec3A.project(this.camera);
          const sx = rect.left + (_vec3A.x * 0.5 + 0.5) * rect.width;
          const sy = rect.top + (-_vec3A.y * 0.5 + 0.5) * rect.height;
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      }
    }

    const pad = 42;
    return (
      clientX >= minX - pad &&
      clientX <= maxX + pad &&
      clientY >= minY - pad &&
      clientY <= maxY + pad
    );
  }

  public triggerMenuCharacterTapAnim(): void {
    if (this.phase !== 'menu') return;
    this.menuTapTimer = 0.65;
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    this.applyQualityProfile();
  }

  private applyQualityProfile(): void {
    const profile = QUALITY_PROFILES[this.graphicsQuality];
    const dpr = window.devicePixelRatio || 1;
    const baseRatio =
      profile.lowResRatio !== null
        ? profile.lowResRatio
        : Math.min(dpr, profile.pixelRatioCap);
    const cappedRatio = this.isSoftwareGl ? Math.min(baseRatio, 1.0) : baseRatio;
    this.renderer.setPixelRatio(cappedRatio);

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = profile.toneExposure;
    this.scene.environment = profile.envIntensity > 0 ? this.envMapTexture : null;
    this.scene.environmentIntensity = profile.envIntensity;

    if (!this.isSoftwareGl) {
      const shadowsOn = profile.shadowsEnabled;
      this.renderer.shadowMap.enabled = shadowsOn;
      if (this.dirLight) {
        this.dirLight.castShadow = shadowsOn;
        if (this.dirLight.shadow.mapSize.x !== profile.shadowMapSize) {
          this.dirLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
          this.dirLight.shadow.map?.dispose();
          this.dirLight.shadow.map = null;
        }
        const d = profile.shadowFrustumHalf;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.camera.updateProjectionMatrix();
        this.renderer.shadowMap.needsUpdate = true;
      }
    } else {
      this.renderer.shadowMap.enabled = false;
      if (this.dirLight) this.dirLight.castShadow = false;
    }

    if (this.camera) {
      let camChanged = false;
      if (this.camera.far !== profile.cameraFar) {
        this.camera.far = profile.cameraFar;
        camChanged = true;
      }
      if (this.phase !== 'playing') {
        const calmFov = this.camera.aspect < 0.85 ? 54 : 45;
        if (this.camera.fov !== calmFov) {
          this.camera.fov = calmFov;
          camChanged = true;
        }
      }
      if (camChanged) {
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.textures) {
      this.textures.setAnisotropy(Math.min(this.maxAniso, profile.anisotropyCap));
    }

    if (this.headlamp) {
      this.headlamp.distance = profile.headlampDistance;
    }

    if (this.menuKeyLight && this.menuRimLight) {
      const isMenu = this.phase === 'menu';
      this.menuKeyLight.visible = isMenu && profile.menuKeyIntensity > 0;
      this.menuRimLight.visible = isMenu && profile.menuRimIntensity > 0;
      if (isMenu) {
        this.menuKeyLight.intensity = profile.menuKeyIntensity;
        this.menuRimLight.intensity = profile.menuRimIntensity;
      }
    }

    const currentZone = ZONES[this.zoneIndex] ?? ZONES[0];
    if (this.starsPoints) {
      const skyAllowsStars =
        currentZone.id === 'mahalle_caddesi' ||
        currentZone.id === 'buzul_dunyasi' ||
        currentZone.id === 'peynir_galaksisi';
      const starAttr = this.starsPoints.geometry.getAttribute('position');
      const totalStars = starAttr ? starAttr.count : 160;
      this.starsPoints.geometry.setDrawRange(0, Math.floor(totalStars * profile.starsRatio));
      this.starsPoints.visible = skyAllowsStars && profile.starsRatio > 0;
    }

    if (this.scene.fog instanceof THREE.Fog && this.phase !== 'playing') {
      const isCave = currentZone.id === 'yeralti_magarasi';
      this.scene.fog.near = isCave ? profile.fogNear * 0.62 : profile.fogNear;
      this.scene.fog.far = isCave ? profile.fogFar * 0.65 : profile.fogFar;
    }

    for (const seg of this.segments) {
      seg.group.visible = seg.biomeVisible && seg.group.position.z >= profile.segmentCutoffZ;
    }

    this.applyAdaptiveParticleRange();
  }

  private applyAdaptiveParticleRange(): void {
    const profile = QUALITY_PROFILES[this.graphicsQuality];
    const scale = profile.particleRatio;
    if (this.snowNearPoints && this.snowFarPoints) {
      const nearTotal = this.snowNearPositions.length / 3;
      const farTotal = this.snowFarPositions.length / 3;
      this.snowNearPoints.geometry.setDrawRange(0, Math.floor(nearTotal * scale));
      this.snowFarPoints.geometry.setDrawRange(
        0,
        this.graphicsQuality === 'low' ? 0 : Math.floor(farTotal * scale),
      );
      if (this.graphicsQuality === 'low') {
        this.snowFarPoints.visible = false;
      }
    }
    if (this.biomeParticles) {
      const bioTotal = this.biomeParticlePositions.length / 3;
      this.biomeParticles.geometry.setDrawRange(0, Math.floor(bioTotal * scale));
    }
  }

  private acquireObstacle(poolKey: string, factory: () => THREE.Group): THREE.Group {
    const bucket = this.obstaclePool.get(poolKey);
    const pooled = bucket?.pop();
    if (pooled) {
      pooled.rotation.set(0, 0, 0);
      const spinTarget = pooled.userData.spinPivot as THREE.Object3D | undefined;
      spinTarget?.rotation.set(0, 0, 0);
      return pooled;
    }
    return factory();
  }

  private releaseObstacle(obs: ActiveObstacle): void {
    this.scene.remove(obs.mesh);
    obs.mesh.rotation.set(0, 0, 0);
    const spinTarget = obs.mesh.userData.spinPivot as THREE.Object3D | undefined;
    spinTarget?.rotation.set(0, 0, 0);
    let bucket = this.obstaclePool.get(obs.poolKey);
    if (!bucket) {
      bucket = [];
      this.obstaclePool.set(obs.poolKey, bucket);
    }
    if (bucket.length < 6) {
      bucket.push(obs.mesh);
    } else {
      this.removeAndDispose(obs.mesh);
    }
  }

  private acquirePowerup(type: PowerupType): THREE.Group {
    const pooled = this.powerupPool.get(type)?.pop();
    if (pooled) {
      pooled.rotation.set(0, 0, 0);
      return pooled;
    }
    return createPowerupModel(type);
  }

  private releasePowerup(p: ActivePowerup): void {
    this.scene.remove(p.mesh);
    p.mesh.rotation.set(0, 0, 0);
    let bucket = this.powerupPool.get(p.type);
    if (!bucket) {
      bucket = [];
      this.powerupPool.set(p.type, bucket);
    }
    if (bucket.length < 6) {
      bucket.push(p.mesh);
    } else {
      this.removeAndDispose(p.mesh);
    }
  }

  private acquireCoin(): THREE.Group {
    const pooled = this.coinPool.pop();
    if (pooled) {
      pooled.rotation.set(0, 0, 0);
      return pooled;
    }
    return createSimitCoinModel();
  }

  private releaseCoin(coin: ActiveCoin): void {
    this.scene.remove(coin.mesh);
    coin.mesh.rotation.set(0, 0, 0);
    if (this.coinPool.length < 64) {
      this.coinPool.push(coin.mesh);
    } else {
      this.removeAndDispose(coin.mesh);
    }
  }

  private removeAndDispose(mesh: THREE.Object3D): void {
    this.scene.remove(mesh);
    mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (obj.userData?.sharedAsset) return;
        if (!obj.userData?.sharedGeometry) {
          obj.geometry?.dispose();
        }
        if (!obj.userData?.sharedMaterial) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      }
    });
  }

  /**
   * Her karakterin gerçek 3D modelinden stüdyo ışıklı PNG portre fotoğrafı üretir.
   */
  public captureSkinPortraits(): Partial<Record<SkinId, string>> {
    const result: Partial<Record<SkinId, string>> = {};
    const size = 256;

    const rt = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    });

    const pScene = new THREE.Scene();
    pScene.environment = this.scene.environment;

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x1e293b, 1.45);
    pScene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff7ed, 2.05);
    key.position.set(2.4, 3.3, 3.6);
    pScene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rim.position.set(-2.5, 2.2, -2.0);
    pScene.add(rim);

    const pCam = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    pCam.position.set(0.36, 1.34, 3.35);
    pCam.lookAt(0, 1.2, 0);

    const prevTarget = this.renderer.getRenderTarget();
    const prevClearAlpha = this.renderer.getClearAlpha();
    const prevClearColor = new THREE.Color();
    this.renderer.getClearColor(prevClearColor);

    const pixelBuffer = new Uint8Array(size * size * 4);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      for (const skin of SKINS) {
        const rig = createCockroachModel(
          skin,
          this.textures.chitinWingTexture,
          this.textures.fabricWeaveTexture,
        );
        rig.root.rotation.y = Math.PI + 0.28;
        rig.leftArm.rotation.x = -0.24;
        rig.rightArm.rotation.x = 0.16;
        pScene.add(rig.root);

        this.renderer.setRenderTarget(rt);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear(true, true, true);
        this.renderer.render(pScene, pCam);
        this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixelBuffer);

        const dst = imgData.data;
        for (let y = 0; y < size; y++) {
          const srcRow = (size - 1 - y) * size * 4;
          const dstRow = y * size * 4;
          for (let x = 0; x < size * 4; x += 4) {
            const a = pixelBuffer[srcRow + x + 3];
            if (a === 0) {
              dst[dstRow + x] = 0;
              dst[dstRow + x + 1] = 0;
              dst[dstRow + x + 2] = 0;
              dst[dstRow + x + 3] = 0;
            } else {
              // Convert linear RT output to sRGB brightness cleanly
              dst[dstRow + x] = Math.min(
                255,
                Math.round(Math.pow(pixelBuffer[srcRow + x] / 255, 1 / 2.1) * 255),
              );
              dst[dstRow + x + 1] = Math.min(
                255,
                Math.round(Math.pow(pixelBuffer[srcRow + x + 1] / 255, 1 / 2.1) * 255),
              );
              dst[dstRow + x + 2] = Math.min(
                255,
                Math.round(Math.pow(pixelBuffer[srcRow + x + 2] / 255, 1 / 2.1) * 255),
              );
              dst[dstRow + x + 3] = a;
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        result[skin.id] = canvas.toDataURL('image/png');

        pScene.remove(rig.root);
        rig.root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (!obj.userData?.sharedAsset && !obj.userData?.sharedGeometry) {
              obj.geometry?.dispose();
            }
            if (!obj.userData?.sharedAsset && !obj.userData?.sharedMaterial) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach((m) => m.dispose());
              } else {
                obj.material?.dispose();
              }
            }
          }
        });
      }
    }

    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClearColor, prevClearAlpha);
    rt.dispose();

    return result;
  }

  public startRun(): void {
    gameAudio.unlock();
    this.clearEntities();

    this.phase = 'playing';
    this.shopPreviewOpen = false;
    this.pedestalGroup.visible = false;
    this.menuKeyLight.visible = false;
    this.menuKeyLight.intensity = 0;
    this.menuRimLight.visible = false;
    this.menuRimLight.intensity = 0;
    this.headlamp.visible = false;
    this.headlamp.intensity = 0;
    this.score = 0;
    this.distance = 0;
    this.runCoins = 0;
    this.speed = BASE_SPEED;
    this.zoneIndex = 0;
    this.stageZones = [...INITIAL_STAGE_ORDER];
    this.biomeRevealTimer = 0;
    this.deathReason = '';
    this.isNewRecord = false;
    this.continueCount = 0;
    this.adReviveUsed = false;
    this.cameraShake = 0;
    this.lastFrameMs = performance.now();
    this.camera.fov = this.camera.aspect < 0.85 ? 54 : 45;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 4.9, 8.0);

    this.targetLane = 1; // Always start dead-center on Orta şerit
    this.playerX = LANE_X[1];
    this.playerY = 0;
    this.currentGroundY = 0;
    this.velY = 0;
    this.isGrounded = true;
    this.jumpBufferTimer = 0;
    this.rollBufferTimer = 0;
    this.rollTimer = 0;
    this.longJumpSpinTimer = 0;
    this.springSafeTimer = 0;
    this.springArcPullTimer = 0;
    this.landSquashTimer = 0;
    this.invulnTimer = 0;
    this.stumbleTimer = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.crashTimer = 0;
    this.magnetTimer = 0;
    this.flashlightTimer = 0;
    this.turboTimer = 0;
    this.wingsTimer = 0;
    this.nextFlightCoinZ = -24;
    this.flightCoinLane = 1;
    this.skyPatternIndex = 0;
    this.lastPowerupSpawnDist = -40;
    this.lastJetpackSpawnDist = -120;
    this.hasShield = false;
    this.metrics = {
      distance: 0,
      coins: 0,
      rolls: 0,
      jumps: 0,
      nearMisses: 0,
      flights: 0,
      powerups: 0,
      magnets: 0,
      shields: 0,
      flashlights: 0,
      turbos: 0,
      zonesReached: ['mahalle_caddesi'],
    };
    this.recordGateActive = false;
    this.recordGatePassed = false;
    this.recordGateZ = -999;
    this.recordGateMesh.visible = false;
    this.jetExhaustEmitAccum = 0;

    this.broomMesh.visible = false;
    this.playerRig.leftWing.visible = false;
    this.playerRig.rightWing.visible = false;
    this.playerRig.jetpackGroup.visible = false;
    this.playerRig.root.visible = true;
    this.playerRig.root.rotation.set(0, 0, 0);
    this.playerRig.root.position.set(this.playerX, 0, 0);
    this.playerRig.rollPivot.rotation.set(0, 0, 0);
    this.playerRig.rollPivot.position.set(0, 0.85, 0);
    this.playerRig.headGroup.rotation.set(0, 0, 0);
    this.playerRig.leftArm.rotation.set(0, 0, 0);
    this.playerRig.rightArm.rotation.set(0, 0, 0);

    this.nextSpawnZ = -42;
    this.nextTrafficWaveZ = -90;
    this.dialogueTimer = 3.2;

    const z0 = ZONES[0];
    this.applyZoneVisuals(z0, true);
    this.updateBiomeGroundPositions();
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.group.position.z = -i * SEGMENT_LENGTH;
      this.updateSegmentBiome(seg, -seg.group.position.z, z0.buildingTint);
    }
    gameAudio.setZoneAmbience(z0.ambienceType);
    gameAudio.setPlaying(true);

    this.triggerDialogue('start');
    this.callbacks.onZoneChange(z0);
    this.emitHud();
  }

  public pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    gameAudio.setPlaying(false);
    this.emitHud();
  }

  public resume(): void {
    if (this.phase !== 'paused') return;
    gameAudio.unlock();
    this.phase = 'playing';
    this.lastFrameMs = performance.now();
    gameAudio.setPlaying(true);
    this.emitHud();
  }

  public returnToMenu(): void {
    this.clearEntities();
    this.phase = 'menu';
    this.jetExhaustEmitAccum = 0;
    this.pedestalGroup.visible = true;
    const menuProfile = QUALITY_PROFILES[this.graphicsQuality];
    this.headlamp.visible = false;
    this.headlamp.intensity = 0;
    this.menuKeyLight.visible = menuProfile.menuKeyIntensity > 0;
    this.menuKeyLight.intensity = menuProfile.menuKeyIntensity;
    this.menuRimLight.visible = menuProfile.menuRimIntensity > 0;
    this.menuRimLight.intensity = menuProfile.menuRimIntensity;
    this.menuSpinYaw = 0;
    this.targetLane = 1;
    this.playerX = 0;
    this.playerY = 0;
    this.currentGroundY = 0;
    this.rollTimer = 0;
    this.wingsTimer = 0;
    this.stumbleTimer = 0;
    this.broomMesh.visible = false;
    this.playerRig.leftWing.visible = false;
    this.playerRig.rightWing.visible = false;
    this.playerRig.jetpackGroup.visible = false;
    this.playerRig.root.visible = true;
    this.playerRig.root.rotation.set(0, Math.PI, 0);
    this.playerRig.rollPivot.rotation.set(0, 0, 0);
    this.playerRig.rollPivot.position.set(0, 0.85, 0);
    this.playerRig.headGroup.rotation.set(0, 0, 0);
    this.playerRig.leftArm.rotation.set(0, 0, 0);
    this.playerRig.rightArm.rotation.set(0, 0, 0);
    this.biomeRevealTimer = 0;
    this.continueCount = 0;
    this.adReviveUsed = false;
    this.distance = 0;
    this.zoneIndex = 0;
    this.stageZones = [...INITIAL_STAGE_ORDER];
    this.applyZoneVisuals(ZONES[0], true);
    this.updateBiomeGroundPositions();
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.group.position.z = -i * SEGMENT_LENGTH;
      this.updateSegmentBiome(seg, -seg.group.position.z, ZONES[0].buildingTint);
    }
    gameAudio.setPlaying(false);
    this.emitHud();
  }

  public getContinueCount(): number {
    return this.continueCount;
  }

  public continueRun(fromAd = false): void {
    if (this.phase !== 'gameover') return;
    if (fromAd) {
      if (this.adReviveUsed) return;
      this.adReviveUsed = true;
    } else {
      this.continueCount += 1;
    }
    gameAudio.unlock();
    this.phase = 'playing';
    this.lastFrameMs = performance.now();
    this.crashTimer = 0;
    this.cameraShake = 0;
    this.invulnTimer = 3.2;
    const floorY = this.getWorldGroundY(this.distance);
    this.playerY = floorY;
    this.currentGroundY = floorY;
    this.velY = 0;
    this.isGrounded = true;
    this.rollTimer = 0;
    this.broomMesh.visible = false;
    this.playerRig.root.visible = true;
    this.playerRig.root.rotation.set(0, 0, 0);
    this.playerRig.rollPivot.rotation.set(0, 0, 0);
    this.playerRig.rollPivot.position.set(0, 0.85, 0);

    this.obstacles = this.obstacles.filter((obs) => {
      if (obs.z > -26) {
        this.releaseObstacle(obs);
        return false;
      }
      return true;
    });

    gameAudio.setPlaying(true);
    gameAudio.playPowerup();
    this.triggerDialogue('revive');
    this.emitHud();
  }

  public moveLeft(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane > 0) {
      this.targetLane -= 1;
      gameAudio.playLaneSwitch();
      if (this.isGrounded) {
        this.spawnBurst(this.playerX, this.playerY + 0.14, 0.1, 0xcbd5e1, 3, 2.2);
      }
    }
  }

  public moveRight(): void {
    if (this.phase !== 'playing') return;
    if (this.targetLane < 2) {
      this.targetLane += 1;
      gameAudio.playLaneSwitch();
      if (this.isGrounded) {
        this.spawnBurst(this.playerX, this.playerY + 0.14, 0.1, 0xcbd5e1, 3, 2.2);
      }
    }
  }

  public jump(): void {
    if (this.phase !== 'playing') return;
    if (this.isGrounded) {
      this.executeJump();
    } else {
      this.jumpBufferTimer = 0.16;
    }
  }

  private executeJump(): void {
    if (this.wingsTimer > 0) return;
    this.velY = 15.4;
    this.isGrounded = false;
    this.rollTimer = 0;
    this.longJumpSpinTimer = 0;
    this.jumpBufferTimer = 0;
    this.rollBufferTimer = 0;
    this.metrics.jumps += 1;
    gameAudio.playJump();
  }

  public slide(): void {
    if (this.phase !== 'playing' || this.wingsTimer > 0) return;
    if (!this.isGrounded) {
      // Pro Subway Surfers fast-fall slam -> buffers into ground roll!
      this.velY = Math.min(this.velY, -34);
      this.rollBufferTimer = 0.25;
      gameAudio.playSlide();
    } else {
      this.executeRoll();
    }
  }

  private executeRoll(): void {
    this.rollTimer = ROLL_DURATION;
    this.rollBufferTimer = 0;
    this.metrics.rolls += 1;
    gameAudio.playSlide();
    this.spawnBurst(this.playerX, this.playerY + 0.18, 0.15, 0xe2e8f0, 5, 2.6);
  }

  private clearEntities(): void {
    this.obstacles.forEach((o) => this.releaseObstacle(o));
    this.coins.forEach((c) => this.releaseCoin(c));
    this.powerups.forEach((p) => this.releasePowerup(p));
    if (this.recordGateMesh) {
      this.recordGateMesh.visible = false;
    }
    this.recordGateActive = false;
    this.recordGatePassed = false;
    if (this.transitionGateMesh) {
      this.transitionGateMesh.visible = false;
    }
    this.transitionGateBoundaryDist = -1;
    this.transitionGateBurstDone = false;
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    _mat4A.compose(_vec3A.set(0, -50, 0), _quatA.identity(), _zeroScale);
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].life = 0;
      this.particleInstancedMesh.setMatrixAt(i, _mat4A);
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.particleInstancedMesh.visible = false;
    for (let i = 0; i < this.jetExhaustPool.length; i++) {
      this.jetExhaustPool[i].life = 0;
      this.jetExhaustInstancedMesh.setMatrixAt(i, _mat4A);
    }
    this.jetExhaustInstancedMesh.instanceMatrix.needsUpdate = true;
    this.jetExhaustInstancedMesh.visible = false;
  }

  private triggerDialogue(trigger: DialogueTrigger): void {
    const line = pickDialogue(trigger, this.lastDialogueId);
    this.lastDialogueId = line.id;
    this.callbacks.onDialogue(line);
  }

  private getZoneIdForStage(stageIdx: number): ZoneId {
    if (stageIdx <= 0) return INITIAL_STAGE_ORDER[0];
    while (this.stageZones.length <= stageIdx + 2) {
      const bag = [...INITIAL_STAGE_ORDER];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      const prevLast = this.stageZones[this.stageZones.length - 1];
      if (bag[0] === prevLast) {
        [bag[0], bag[1]] = [bag[1], bag[0]];
      }
      this.stageZones.push(...bag);
    }
    return this.stageZones[stageIdx];
  }

  private getZoneConfigById(zoneId: ZoneId): ZoneConfig {
    return ZONES.find((z) => z.id === zoneId) || ZONES[0];
  }

  private getZoneIndexById(zoneId: ZoneId): number {
    const idx = ZONES.findIndex((z) => z.id === zoneId);
    return idx >= 0 ? idx : 0;
  }

  private getEarthWindowForWorldDist(worldDist: number): {
    inEarth: boolean;
    descentStart: number;
    descentEnd: number;
    stairStart: number;
    stairEnd: number;
  } | null {
    const centerStage = Math.max(0, Math.floor(worldDist / ZONE_DISTANCE));
    for (let s = Math.max(0, centerStage - 1); s <= centerStage + 1; s++) {
      if (this.getZoneIdForStage(s) !== 'yeralti_magarasi') continue;
      const stageStart = s * ZONE_DISTANCE;
      const stageEnd = (s + 1) * ZONE_DISTANCE;
      const descentStart = stageStart - 30;
      const descentEnd = stageStart - 2;
      const stairStart = stageEnd - 18;
      const stairEnd = stageEnd + 10;
      if (worldDist >= descentStart && worldDist < stairEnd) {
        return {
          inEarth: true,
          descentStart,
          descentEnd,
          stairStart,
          stairEnd,
        };
      }
    }
    return null;
  }

  private getWorldGroundY(worldDist: number): number {
    const ew = this.getEarthWindowForWorldDist(worldDist);
    if (!ew) return 0;
    if (worldDist < ew.descentEnd) {
      return (
        TUNNEL_DEPTH *
        ((worldDist - ew.descentStart) / (ew.descentEnd - ew.descentStart))
      );
    }
    if (worldDist < ew.stairStart) {
      return TUNNEL_DEPTH;
    }
    return (
      TUNNEL_DEPTH *
      (1 - (worldDist - ew.stairStart) / (ew.stairEnd - ew.stairStart))
    );
  }

  private getEffectiveZoneId(worldDist: number): ZoneId {
    const safeDist = Math.max(0, worldDist);
    if (this.getEarthWindowForWorldDist(safeDist)) {
      return 'yeralti_magarasi';
    }
    const stageIdx = Math.floor(safeDist / ZONE_DISTANCE);
    if (stageIdx > 0 && this.getZoneIdForStage(stageIdx) === 'yeralti_magarasi') {
      // Right before descent portal (-30m) is already handled above;
      // right after staircase exit (stageEnd .. stageEnd + 10) is also handled above.
    }
    return this.getZoneIdForStage(stageIdx);
  }

  private getZoneIndexForWorldDist(worldDist: number): number {
    return this.getZoneIndexById(this.getEffectiveZoneId(worldDist));
  }

  private getFlightHoverOffset(worldDist: number): number {
    const ew = this.getEarthWindowForWorldDist(worldDist);
    const skyH = 9.6;
    const tunnelH = 4.6;
    if (ew) {
      return tunnelH;
    }
    // Smooth ramp down 24m before approaching any Yeraltı tunnel entrance
    const nextStage = Math.floor(Math.max(0, worldDist) / ZONE_DISTANCE) + 1;
    if (this.getZoneIdForStage(nextStage) === 'yeralti_magarasi') {
      const descentStart = nextStage * ZONE_DISTANCE - 30;
      if (worldDist >= descentStart - 24 && worldDist < descentStart) {
        const k = (worldDist - (descentStart - 24)) / 24;
        return skyH + (tunnelH - skyH) * k;
      }
    }
    // Smooth climb back up 24m after exiting any Yeraltı staircase
    const currStage = Math.floor(Math.max(0, worldDist) / ZONE_DISTANCE);
    if (currStage > 0 && this.getZoneIdForStage(currStage - 1) === 'yeralti_magarasi') {
      const stairEnd = currStage * ZONE_DISTANCE + 10;
      if (worldDist >= stairEnd && worldDist < stairEnd + 24) {
        const k = (worldDist - stairEnd) / 24;
        return tunnelH + (skyH - tunnelH) * k;
      }
    }
    return skyH;
  }

  private updateBiomeGroundPositions(): void {
    const currStage = Math.max(0, Math.floor(this.distance / ZONE_DISTANCE));
    let activeDescentZ: number | null = null;
    let activeStairZ: number | null = null;

    for (let s = Math.max(0, currStage - 1); s <= currStage + 2; s++) {
      if (this.getZoneIdForStage(s) !== 'yeralti_magarasi') continue;
      const stageStart = s * ZONE_DISTANCE;
      const stageEnd = (s + 1) * ZONE_DISTANCE;
      // 28m descent centered at stageStart - 16 spans [stageStart - 30, stageStart - 2]
      const descentZ = this.distance - (stageStart - 16);
      if (descentZ > -240 && descentZ < 45) {
        activeDescentZ = descentZ;
      }
      // 28m staircase centered at stageEnd - 4 spans [stageEnd - 18, stageEnd + 10]
      const stairZ = this.distance - (stageEnd - 4);
      if (stairZ > -240 && stairZ < 45) {
        activeStairZ = stairZ;
      }
    }

    if (this.descentTunnelMesh) {
      if (activeDescentZ !== null) {
        this.descentTunnelMesh.position.z = activeDescentZ;
        this.descentTunnelMesh.visible = true;
      } else {
        this.descentTunnelMesh.visible = false;
      }
    }
    if (this.staircaseExitMesh) {
      if (activeStairZ !== null) {
        this.staircaseExitMesh.position.z = activeStairZ;
        this.staircaseExitMesh.visible = true;
      } else {
        this.staircaseExitMesh.visible = false;
      }
    }

    // Position a crisp 3D thematic arch gate at upcoming non-tunnel 1000m boundaries
    let targetBoundary = -1;
    let nextBiome: ZoneConfig | null = null;
    for (let s = currStage; s <= currStage + 1; s++) {
      const boundaryDist = (s + 1) * ZONE_DISTANCE;
      const zRel = this.distance - boundaryDist;
      if (zRel > -165 && zRel < 22) {
        const fromId = this.getZoneIdForStage(s);
        const toId = this.getZoneIdForStage(s + 1);
        if (fromId !== 'yeralti_magarasi' && toId !== 'yeralti_magarasi') {
          targetBoundary = boundaryDist;
          nextBiome = this.getZoneConfigById(toId);
          break;
        }
      }
    }

    if (targetBoundary > 0 && nextBiome) {
      if (this.transitionGateBoundaryDist !== targetBoundary) {
        const glowMat = this.transitionGateMesh.userData.glowMat as
          | THREE.MeshBasicMaterial
          | undefined;
        const trimMat = this.transitionGateMesh.userData.trimMat as
          | THREE.MeshStandardMaterial
          | undefined;
        glowMat?.color.setHex(nextBiome.lampColor);
        if (trimMat) {
          trimMat.color.setHex(nextBiome.buildingTint);
          trimMat.emissive.setHex(nextBiome.lampColor);
        }
        this.transitionGateBoundaryDist = targetBoundary;
        this.transitionGateBurstDone = false;
      }
      this.transitionGateMesh.position.set(0, 0, this.distance - targetBoundary);
      this.transitionGateMesh.visible = true;
    } else {
      this.transitionGateMesh.visible = false;
    }
  }

  private updateSegmentBiome(
    seg: StreetSegment,
    rawWorldDist: number,
    _buildingTint: number,
    forceSync = false,
  ): void {
    const segWorldDist = Math.round(rawWorldDist / SEGMENT_LENGTH) * SEGMENT_LENGTH;
    const checkStage = Math.max(0, Math.floor(Math.max(0, segWorldDist) / ZONE_DISTANCE));
    for (let s = Math.max(0, checkStage - 1); s <= checkStage + 1; s++) {
      if (this.getZoneIdForStage(s) !== 'yeralti_magarasi') continue;
      const stageStart = s * ZONE_DISTANCE;
      const stageEnd = (s + 1) * ZONE_DISTANCE;
      // Hide exact 20m segments covered by 28m descent [stageStart-30..stageStart-2] and stair [stageEnd-18..stageEnd+10]
      if (
        (segWorldDist >= stageStart - 25 && segWorldDist <= stageStart - 15) ||
        (segWorldDist >= stageEnd - 5 && segWorldDist <= stageEnd + 5)
      ) {
        seg.biomeVisible = false;
        seg.group.visible = false;
        return;
      }
    }

    seg.biomeVisible = true;
    seg.group.visible =
      seg.group.position.z >= QUALITY_PROFILES[this.graphicsQuality].segmentCutoffZ;
    const zId = this.getEffectiveZoneId(segWorldDist);
    seg.group.position.y = zId === 'yeralti_magarasi' ? TUNNEL_DEPTH : 0;
    this.applySegmentEnvironment(seg, zId, forceSync);
  }

  private applyZoneVisuals(zone: ZoneConfig, instant = false): void {
    const profile = QUALITY_PROFILES[this.graphicsQuality];
    this.moonMesh.visible =
      zone.id === 'mahalle_caddesi' ||
      zone.id === 'buzul_dunyasi' ||
      zone.id === 'peynir_galaksisi';
    this.starsPoints.visible =
      profile.starsRatio > 0 &&
      (zone.id === 'mahalle_caddesi' ||
        zone.id === 'buzul_dunyasi' ||
        zone.id === 'peynir_galaksisi');
    if (this.biomeParticles && zone.id === 'mahalle_caddesi') {
      this.biomeParticles.visible = false;
    }
    if (this.snowNearPoints && zone.id !== 'buzul_dunyasi') {
      this.snowNearPoints.visible = false;
    }
    if (this.snowFarPoints && zone.id !== 'buzul_dunyasi') {
      this.snowFarPoints.visible = false;
    }
    if (instant) {
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.setHex(zone.skyColor);
      }
      if (this.scene.fog instanceof THREE.Fog) {
        const isCave = zone.id === 'yeralti_magarasi';
        this.scene.fog.color.setHex(zone.fogColor);
        this.scene.fog.near = isCave ? profile.fogNear * 0.62 : profile.fogNear;
        this.scene.fog.far = isCave ? profile.fogFar * 0.65 : profile.fogFar;
      }
      this.dirLight.intensity = zone.lightIntensity * 1.38;
      this.hemiLight.intensity = zone.lightIntensity * 0.9;
      this.updateBiomeGroundPositions();
      this.segments.forEach((seg, idx) => {
        seg.group.position.z = -idx * SEGMENT_LENGTH;
        this.updateSegmentBiome(seg, idx * SEGMENT_LENGTH, zone.buildingTint, true);
      });
    }
  }

  // --- Biome Pattern Generator ---

  private spawnPattern(zStart: number): number {
    const spawnWorldDist = this.distance + Math.max(0, -zStart);
    const zone = ZONES[this.getZoneIndexForWorldDist(spawnWorldDist)];
    const distInZone = spawnWorldDist % ZONE_DISTANCE;
    const currStage = Math.max(0, Math.floor(spawnWorldDist / ZONE_DISTANCE));
    const ew = this.getEarthWindowForWorldDist(spawnWorldDist);
    const approachingEarthMouth =
      this.getZoneIdForStage(currStage + 1) === 'yeralti_magarasi' &&
      spawnWorldDist >= (currStage + 1) * ZONE_DISTANCE - 74;

    // Keep descent tunnel ramp, exit staircase, and 1000m gate boundaries obstacle-free with guiding coins!
    const onTunnelSlope =
      approachingEarthMouth ||
      (ew !== null &&
        ((spawnWorldDist >= ew.descentStart - 16 && spawnWorldDist <= ew.descentEnd + 10) ||
          (spawnWorldDist >= ew.stairStart - 12 && spawnWorldDist <= ew.stairEnd + 14)));
    const nearGateBoundary =
      spawnWorldDist > 200 &&
      (distInZone >= ZONE_DISTANCE - 32 || distInZone <= 22);
    if (onTunnelSlope || nearGateBoundary) {
      const safeLane = onTunnelSlope ? 1 : Math.floor(Math.random() * 3);
      this.spawnCoinLine(safeLane, zStart, 5, 2.2);
      return 16;
    }

    const roll = Math.random();
    const safeLane = Math.floor(Math.random() * 3);
    const isCity = zone.id === 'mahalle_caddesi';

    const rampKind: ObstacleKind = isCity ? 'bus_ramp' : 'terrain_ramp';
    const heavyKind: ObstacleKind =
      zone.id === 'yeralti_magarasi'
        ? 'mine_cart'
        : zone.id === 'buzul_dunyasi'
          ? 'ice_wall'
          : zone.id === 'ates_diyari'
            ? 'lava_rock'
            : zone.id === 'dev_mutfak'
              ? 'rolling_pin'
              : zone.id === 'kopuklu_banyo'
                ? 'giant_slipper'
                : zone.id === 'cilgin_lab'
                  ? 'raid_can'
                  : zone.id === 'peynir_galaksisi'
                    ? 'ufo_saucer'
                    : 'taxi';
    const mediumKind: ObstacleKind =
      zone.id === 'yeralti_magarasi'
        ? 'earth_boulder'
        : zone.id === 'buzul_dunyasi'
          ? 'ice_crystal'
          : zone.id === 'ates_diyari'
            ? 'fire_pillar'
            : zone.id === 'dev_mutfak'
              ? 'butter_block'
              : zone.id === 'kopuklu_banyo'
                ? 'soap_bar'
                : zone.id === 'cilgin_lab'
                  ? 'beaker_vat'
                  : zone.id === 'peynir_galaksisi'
                    ? 'cheese_asteroid'
                    : 'dumpster';
    const archKind: ObstacleKind =
      zone.id === 'yeralti_magarasi'
        ? 'root_arch'
        : zone.id === 'buzul_dunyasi'
          ? 'icicle_arch'
          : zone.id === 'ates_diyari'
            ? 'magma_arch'
            : zone.id === 'dev_mutfak'
              ? 'toaster_arch'
              : zone.id === 'kopuklu_banyo'
                ? 'towel_arch'
                : zone.id === 'cilgin_lab'
                  ? 'laser_arch'
                  : zone.id === 'peynir_galaksisi'
                    ? 'warp_arch'
                    : 'road_sign';
    const lowKind: ObstacleKind =
      zone.id === 'yeralti_magarasi'
        ? 'mushroom_cluster'
        : zone.id === 'buzul_dunyasi'
          ? 'snow_ball'
          : zone.id === 'ates_diyari'
            ? 'fire_barrel'
            : zone.id === 'dev_mutfak'
              ? 'tomato_ball'
              : zone.id === 'kopuklu_banyo'
                ? 'tp_roll'
                : zone.id === 'cilgin_lab'
                  ? 'jelly_cube'
                  : zone.id === 'peynir_galaksisi'
                    ? 'space_meteor'
                    : Math.random() < 0.5
                      ? 'cone'
                      : 'tire';

    // 0. Dedicated Straight-Lane City Traffic Express (never zigzags, never blocked at spawn!)
    if (
      isCity &&
      this.distance > 65 &&
      distInZone < ZONE_DISTANCE - 95 &&
      Math.random() < 0.22
    ) {
      const fwdRange = this.getVehicleClearanceForward(zStart - 2);
      const candidateLanes = [0, 1, 2].filter(
        (l) =>
          this.isLaneCorridorClearForVehicle(l, zStart - 2, fwdRange, 14) &&
          !this.wouldMovingVehicleBlockAllLanes(l, zStart - 2, fwdRange),
      );
      if (candidateLanes.length > 0) {
        const trafficLane =
          candidateLanes[Math.floor(Math.random() * candidateLanes.length)];
        this.spawnObstacle('moving_taxi', trafficLane, zStart - 2, zone.id);
        const guideLane = (trafficLane + 1) % 3;
        this.spawnCoinLine(guideLane, zStart + 1, 5, 2.2);
        const thirdLane = (trafficLane + 2) % 3;
        if (Math.random() < 0.6) {
          this.spawnObstacle(lowKind, thirdLane, zStart - 1, zone.id);
        } else if (Math.random() < 0.45) {
          this.spawnRandomPowerup(thirdLane, zStart - 3, zone.isDark);
        }
        return 24;
      }
    }

    // 1. Climbable Ramp + Roof Run Coins
    if (roll < 0.2) {
      const rampLane = Math.floor(Math.random() * 3);
      this.spawnObstacle(rampKind, rampLane, zStart - 2, zone.id);
      this.spawnCoinLine(rampLane, zStart - 0.5, 4, 1.4, BUS_ROOF_Y + 0.35);
      const otherLane = (rampLane + 1) % 3;
      const otherHeavy = isCity
        ? this.pickCityHeavyKind(otherLane, zStart - 3)
        : heavyKind;
      this.spawnObstacle(otherHeavy, otherLane, zStart - 3, zone.id);
      if (Math.random() < 0.45) {
        this.spawnRandomPowerup((rampLane + 2) % 3, zStart - 2, zone.isDark);
      }
      return 26;
    }

    // 2. Super Spring Launch Pad -> Parabolic Sky Coin Arc + Safe 44m Landing Zone!
    if (roll < 0.34) {
      const padLane = Math.floor(Math.random() * 3);
      this.spawnObstacle('spring_pad', padLane, zStart, zone.id);
      this.spawnHighSkyArc(padLane, zStart);
      const sideLane = (padLane + 1) % 3;
      this.spawnObstacle(mediumKind, sideLane, zStart, zone.id);
      return 44;
    }

    // 3. Double lane blockers
    if (roll < 0.54) {
      for (let lane = 0; lane < 3; lane++) {
        if (lane !== safeLane) {
          const laneHeavy = isCity
            ? this.pickCityHeavyKind(lane, zStart)
            : heavyKind;
          this.spawnObstacle(
            Math.random() < 0.55 ? laneHeavy : mediumKind,
            lane,
            zStart,
            zone.id,
          );
        } else {
          this.spawnCoinLine(lane, zStart + 2, 5, 2.3);
        }
      }
      return 23;
    }

    // 4. Overhead Arch (Roll Under) + Low Trip/Roll Hazard
    if (roll < 0.72) {
      const archLane = Math.floor(Math.random() * 3);
      this.spawnObstacle(archKind, archLane, zStart, zone.id);
      this.spawnCoinLine(archLane, zStart + 1.5, 4, 2.2, 0.25);

      const otherLane = (archLane + 1) % 3;
      this.spawnObstacle(lowKind, otherLane, zStart, zone.id);
      return 20;
    }

    // 5. Hazard / Phone Roach + Heavy Blocker
    if (roll < 0.87) {
      const altLane = Math.floor(Math.random() * 3);
      this.spawnObstacle(isCity ? 'phone_roach' : lowKind, altLane, zStart, zone.id);
      const thirdLane = (altLane + 2) % 3;
      const thirdHeavy = isCity
        ? this.pickCityHeavyKind(thirdLane, zStart - 2)
        : heavyKind;
      this.spawnObstacle(thirdHeavy, thirdLane, zStart - 2, zone.id);
      this.spawnCoinLine((altLane + 1) % 3, zStart, 5, 2.2);
      if (Math.random() < 0.4) {
        this.spawnRandomPowerup((altLane + 1) % 3, zStart - 9, zone.isDark);
      }
      return 22;
    }

    // 6. Coin Run + Powerup
    const coinLane = Math.floor(Math.random() * 3);
    this.spawnCoinLine(coinLane, zStart, 7, 2.1);
    if (Math.random() < 0.65) {
      this.spawnRandomPowerup((coinLane + 1) % 3, zStart - 4, zone.isDark);
    }
    return 19;
  }

  private getVehicleClearanceForward(z: number): number {
    const distToPlayer = Math.max(0, -z);
    const catchup = distToPlayer * (9.5 / (Math.max(BASE_SPEED, this.speed) + 9.5));
    return Math.ceil(catchup) + 14;
  }

  private isLaneCorridorClearForVehicle(
    lane: number,
    z: number,
    forwardRange: number,
    backRange: number,
    excludeId = -1,
  ): boolean {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.id === excludeId || obs.lane !== lane) continue;
      if (obs.z + obs.halfDepth > z - backRange && obs.z - obs.halfDepth < z + forwardRange) {
        return false;
      }
    }
    return true;
  }

  private wouldMovingVehicleBlockAllLanes(
    targetLane: number,
    z: number,
    forwardRange: number,
  ): boolean {
    const zMin = z - 8;
    const zMax = Math.min(4, z + forwardRange + 8);
    const otherLanes = [0, 1, 2].filter((l) => l !== targetLane);
    const laneA = otherLanes[0];
    const laneB = otherLanes[1];
    for (let i = 0; i < this.obstacles.length; i++) {
      const obsA = this.obstacles[i];
      if (obsA.lane !== laneA || obsA.z + obsA.halfDepth < zMin || obsA.z - obsA.halfDepth > zMax) {
        continue;
      }
      for (let j = 0; j < this.obstacles.length; j++) {
        const obsB = this.obstacles[j];
        if (
          obsB.lane !== laneB ||
          obsB.z + obsB.halfDepth < zMin ||
          obsB.z - obsB.halfDepth > zMax
        ) {
          continue;
        }
        if (Math.abs(obsA.z - obsB.z) < obsA.halfDepth + obsB.halfDepth + 12) {
          return true;
        }
      }
    }
    return false;
  }

  private pickCityHeavyKind(lane: number, z: number): ObstacleKind {
    if (this.distance <= 75 || Math.random() >= 0.55) return 'taxi';
    const worldDist = this.distance + Math.max(0, -z);
    const distInZone = worldDist % ZONE_DISTANCE;
    if (distInZone >= ZONE_DISTANCE - 95) return 'taxi';
    const fwdRange = this.getVehicleClearanceForward(z);
    if (
      !this.isLaneCorridorClearForVehicle(lane, z, fwdRange, 14) ||
      this.wouldMovingVehicleBlockAllLanes(lane, z, fwdRange)
    ) {
      return 'taxi';
    }
    return 'moving_taxi';
  }

  private spawnObstacle(
    kind: ObstacleKind,
    lane: number,
    z: number,
    zoneOverride?: ZoneId,
  ): void {
    const zoneId = zoneOverride ?? ZONES[this.zoneIndex].id;
    let poolKey: string = kind;
    let mesh: THREE.Group;
    let height = 1.8;
    let minY = 0;
    let halfDepth = 0.85;

    switch (kind) {
      case 'taxi':
        mesh = this.acquireObstacle(poolKey, createTaxiModel);
        height = 1.65;
        halfDepth = 1.65;
        break;
      case 'moving_taxi':
        mesh = this.acquireObstacle(poolKey, createMovingTaxiModel);
        height = 1.65;
        halfDepth = 1.72;
        break;
      case 'bus_ramp':
        mesh = this.acquireObstacle(poolKey, createCityBusWithRampModel);
        height = BUS_ROOF_Y;
        halfDepth = 3.85;
        break;
      case 'terrain_ramp':
        poolKey = `terrain_ramp_${zoneId}`;
        mesh = this.acquireObstacle(poolKey, () =>
          zoneId === 'yeralti_magarasi'
            ? createEarthRampModel()
            : zoneId === 'buzul_dunyasi'
              ? createIceRampModel()
              : zoneId === 'ates_diyari'
                ? createLavaRampModel()
                : zoneId === 'dev_mutfak'
                  ? createKitchenRampModel()
                  : zoneId === 'kopuklu_banyo'
                    ? createBathRampModel()
                    : zoneId === 'cilgin_lab'
                      ? createLabRampModel()
                      : createSpaceRampModel(),
        );
        height = BUS_ROOF_Y;
        halfDepth = 3.85;
        break;
      case 'spring_pad':
        mesh = this.acquireObstacle(poolKey, createSpringPadModel);
        height = 0.45;
        halfDepth = 0.85;
        break;
      case 'dumpster':
        mesh = this.acquireObstacle(poolKey, createDumpsterModel);
        height = 1.5;
        halfDepth = 0.65;
        break;
      case 'cone':
        mesh = this.acquireObstacle(poolKey, createConeBarrierModel);
        height = 0.85;
        halfDepth = 0.28;
        break;
      case 'tire':
        mesh = this.acquireObstacle(poolKey, createTireModel);
        height = 1.38;
        halfDepth = 0.26;
        break;
      case 'road_sign':
        mesh = this.acquireObstacle(poolKey, createRoadSignHighModel);
        minY = 1.45;
        height = 2.2;
        halfDepth = 0.22;
        break;
      case 'phone_roach': {
        const variantIdx = Math.random() < 0.65 ? 0 : 2;
        poolKey = `phone_roach_${variantIdx}`;
        const roachSkin = SKINS[variantIdx];
        mesh = this.acquireObstacle(poolKey, () =>
          createPhoneRoachObstacle(
            roachSkin,
            this.textures.chitinWingTexture,
            this.textures.fabricWeaveTexture,
          ),
        );
        height = 1.95;
        halfDepth = 0.38;
        break;
      }
      case 'mine_cart':
        mesh = this.acquireObstacle(poolKey, createMineCartModel);
        height = 1.65;
        halfDepth = 1.0;
        break;
      case 'earth_boulder':
        mesh = this.acquireObstacle(poolKey, createEarthBoulderModel);
        height = 1.62;
        halfDepth = 0.78;
        break;
      case 'root_arch':
        mesh = this.acquireObstacle(poolKey, createRootArchModel);
        minY = 1.45;
        height = 2.2;
        halfDepth = 0.34;
        break;
      case 'mushroom_cluster':
        mesh = this.acquireObstacle(poolKey, createMushroomClusterModel);
        height = 1.1;
        halfDepth = 0.48;
        break;
      case 'ice_wall':
        mesh = this.acquireObstacle(poolKey, createIceWallModel);
        height = 1.88;
        halfDepth = 0.62;
        break;
      case 'ice_crystal':
        mesh = this.acquireObstacle(poolKey, createIceCrystalModel);
        height = 1.95;
        halfDepth = 0.62;
        break;
      case 'icicle_arch':
        mesh = this.acquireObstacle(poolKey, createIcicleArchModel);
        minY = 1.38;
        height = 2.2;
        halfDepth = 0.26;
        break;
      case 'snow_ball':
        mesh = this.acquireObstacle(poolKey, createSnowBallModel);
        height = 1.25;
        halfDepth = 0.56;
        break;
      case 'lava_rock':
        mesh = this.acquireObstacle(poolKey, createLavaRockModel);
        height = 1.65;
        halfDepth = 0.78;
        break;
      case 'fire_pillar':
        mesh = this.acquireObstacle(poolKey, createFirePillarModel);
        height = 2.02;
        halfDepth = 0.52;
        break;
      case 'magma_arch':
        mesh = this.acquireObstacle(poolKey, createMagmaArchModel);
        minY = 1.48;
        height = 2.15;
        halfDepth = 0.26;
        break;
      case 'fire_barrel':
        mesh = this.acquireObstacle(poolKey, createFireBarrelModel);
        height = 1.12;
        halfDepth = 0.5;
        break;
      case 'rolling_pin':
        mesh = this.acquireObstacle(poolKey, createRollingPinModel);
        height = 1.14;
        halfDepth = 0.52;
        break;
      case 'butter_block':
        mesh = this.acquireObstacle(poolKey, createButterBlockModel);
        height = 1.38;
        halfDepth = 1.0;
        break;
      case 'toaster_arch':
        mesh = this.acquireObstacle(poolKey, createToasterArchModel);
        minY = 1.45;
        height = 2.55;
        halfDepth = 0.28;
        break;
      case 'tomato_ball':
        mesh = this.acquireObstacle(poolKey, createTomatoBallModel);
        height = 1.12;
        halfDepth = 0.56;
        break;
      case 'giant_slipper':
        mesh = this.acquireObstacle(poolKey, createGiantSlipperModel);
        height = 1.42;
        halfDepth = 1.46;
        break;
      case 'soap_bar':
        mesh = this.acquireObstacle(poolKey, createSoapBarModel);
        height = 1.42;
        halfDepth = 0.65;
        break;
      case 'towel_arch':
        mesh = this.acquireObstacle(poolKey, createTowelArchModel);
        minY = 1.42;
        height = 2.3;
        halfDepth = 0.22;
        break;
      case 'tp_roll':
        mesh = this.acquireObstacle(poolKey, createTpRollModel);
        height = 1.12;
        halfDepth = 0.52;
        break;
      case 'raid_can':
        mesh = this.acquireObstacle(poolKey, createRaidCanModel);
        height = 2.0;
        halfDepth = 0.72;
        break;
      case 'beaker_vat':
        mesh = this.acquireObstacle(poolKey, createBeakerVatModel);
        height = 1.65;
        halfDepth = 0.82;
        break;
      case 'laser_arch':
        mesh = this.acquireObstacle(poolKey, createLaserArchModel);
        minY = 1.44;
        height = 2.35;
        halfDepth = 0.22;
        break;
      case 'jelly_cube':
        mesh = this.acquireObstacle(poolKey, createJellyCubeModel);
        height = 1.05;
        halfDepth = 0.54;
        break;
      case 'ufo_saucer':
        mesh = this.acquireObstacle(poolKey, createUfoSaucerModel);
        height = 1.72;
        halfDepth = 1.08;
        break;
      case 'cheese_asteroid':
        mesh = this.acquireObstacle(poolKey, createCheeseAsteroidModel);
        height = 1.78;
        halfDepth = 0.85;
        break;
      case 'warp_arch':
        mesh = this.acquireObstacle(poolKey, createWarpArchModel);
        minY = 1.52;
        height = 2.15;
        halfDepth = 0.24;
        break;
      case 'space_meteor':
        mesh = this.acquireObstacle(poolKey, createSpaceMeteorModel);
        height = 1.25;
        halfDepth = 0.58;
        break;
    }

    const baseY = this.getWorldGroundY(this.distance + Math.max(0, -z));
    mesh.position.set(LANE_X[lane], baseY, z);
    this.scene.add(mesh);
    this.obstacles.push({
      id: this.nextObstacleId++,
      kind,
      poolKey,
      lane,
      z,
      baseY,
      mesh,
      trafficSpeed: kind === 'moving_taxi' ? 9.5 : undefined,
      visualX: LANE_X[lane],
      height,
      minY,
      halfDepth,
    });
  }

  private spawnTrafficRushWave(z: number): boolean {
    // Only pick lanes clear across the vehicle's actual catchup distance so traffic flows straight & freely without clipping
    const fwdRange = this.getVehicleClearanceForward(z);
    const clearLanes = [0, 1, 2].filter(
      (l) =>
        this.isLaneCorridorClearForVehicle(l, z, fwdRange, 14) &&
        !this.wouldMovingVehicleBlockAllLanes(l, z, fwdRange),
    );
    if (clearLanes.length === 0) return false;

    const chosenLane = clearLanes[Math.floor(Math.random() * clearLanes.length)];
    this.spawnObstacle('moving_taxi', chosenLane, z, 'mahalle_caddesi');
    gameAudio.playTrafficWarning();
    return true;
  }

  private spawnCoinLine(
    lane: number,
    zStart: number,
    count: number,
    step: number,
    localY = 0.2,
  ): void {
    for (let i = 0; i < count; i++) {
      const mesh = this.acquireCoin();
      const z = zStart - i * step;
      const baseY = this.getWorldGroundY(this.distance + Math.max(0, -z));
      const y = baseY + localY;
      mesh.position.set(LANE_X[lane], y, z);
      this.scene.add(mesh);
      this.coins.push({ lane, z, y, localY, mesh });
    }
  }

  private getSkyFlightCoinY(worldDist: number): number {
    // Level aerial floor inside tunnel vs crisp level sky height outdoors (no sagging transitions!)
    if (this.getEarthWindowForWorldDist(worldDist)) {
      return TUNNEL_DEPTH + 4.35;
    }
    return 9.35;
  }

  private isCrossingTunnelMouth(zStart: number, spanLen: number): boolean {
    const wStart = this.distance + Math.max(0, -zStart);
    const wEnd = this.distance + Math.max(0, -zStart + spanLen);
    const check = (wd: number) => {
      const ew = this.getEarthWindowForWorldDist(wd);
      if (ew) {
        if (wd >= ew.descentStart - 26 && wd <= ew.descentEnd + 10) return true;
        if (wd >= ew.stairStart - 12 && wd <= ew.stairEnd + 24) return true;
      }
      const nextStage = Math.floor(Math.max(0, wd) / ZONE_DISTANCE) + 1;
      if (this.getZoneIdForStage(nextStage) === 'yeralti_magarasi') {
        const descentStart = nextStage * ZONE_DISTANCE - 30;
        if (wd >= descentStart - 26 && wd <= descentStart + 36) return true;
      }
      const currStage = Math.floor(Math.max(0, wd) / ZONE_DISTANCE);
      if (currStage > 0 && this.getZoneIdForStage(currStage - 1) === 'yeralti_magarasi') {
        const stairEnd = currStage * ZONE_DISTANCE + 10;
        if (wd >= stairEnd - 30 && wd <= stairEnd + 24) return true;
      }
      return false;
    };
    return check(wStart) || check(wEnd);
  }

  private addSkyCoin(x: number, y: number, z: number): void {
    const mesh = this.acquireCoin();
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    const nearestLane = x < -1.3 ? 0 : x > 1.3 ? 2 : 1;
    this.coins.push({
      lane: nearestLane,
      z,
      y,
      localY: y,
      isSkyCoin: true,
      mesh,
    });
  }

  private spawnSkyFlightFormation(zStart: number): number {
    const count = 8;
    const step = 2.05;
    const spanLen = (count - 1) * step;

    // Never spawn aerial coins across a tunnel portal cliff so ribbons never droop downward!
    if (this.isCrossingTunnelMouth(zStart, spanLen)) {
      return 16;
    }

    const baseSkyY = this.getSkyFlightCoinY(this.distance + Math.max(0, -zStart));
    const pattern = this.skyPatternIndex % 4;
    this.skyPatternIndex += 1;

    const fromLane = this.flightCoinLane;
    const others = [0, 1, 2].filter((l) => l !== fromLane);
    const toLane = others[Math.floor(Math.random() * others.length)];

    if (pattern === 0) {
      // 1. Diagonal S-Curve weaving smoothly across lanes
      const startX = LANE_X[fromLane];
      const endX = LANE_X[toLane];
      for (let i = 0; i < count; i++) {
        const frac = i / (count - 1);
        const smoothFrac = 0.5 - 0.5 * Math.cos(Math.PI * frac);
        const x = startX + (endX - startX) * smoothFrac;
        const z = zStart - i * step;
        this.addSkyCoin(x, baseSkyY, z);
      }
      this.flightCoinLane = toLane;
      return spanLen + 4.5;
    }

    if (pattern === 1) {
      // 2. Twin Parallel Sky Rails (2 lanes lit up side-by-side!)
      const railA = fromLane;
      const railB = railA === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
      for (let i = 0; i < 6; i++) {
        const z = zStart - i * 2.3;
        this.addSkyCoin(LANE_X[railA], baseSkyY, z);
        this.addSkyCoin(LANE_X[railB], baseSkyY, z);
      }
      this.flightCoinLane = railB;
      return 5 * 2.3 + 5.0;
    }

    if (pattern === 2) {
      // 3. Gently undulating Sky Wave + optional Mid-Air Bonus Orb!
      for (let i = 0; i < count; i++) {
        const z = zStart - i * step;
        const wave = Math.sin((i / (count - 1)) * Math.PI) * 0.55;
        this.addSkyCoin(LANE_X[fromLane], baseSkyY + wave, z);
      }
      if (Math.random() < 0.55) {
        const bonusPool: PowerupType[] = ['magnet', 'shield', 'turbo'];
        const bonusType = bonusPool[Math.floor(Math.random() * bonusPool.length)];
        const bonusMesh = this.acquirePowerup(bonusType);
        const bonusZ = zStart - spanLen * 0.5;
        const bonusLane = toLane;
        bonusMesh.position.set(LANE_X[bonusLane], baseSkyY - 0.35, bonusZ);
        this.scene.add(bonusMesh);
        this.powerups.push({
          type: bonusType,
          lane: bonusLane,
          z: bonusZ,
          baseY: baseSkyY - 0.35,
          localY: baseSkyY - 0.35,
          mesh: bonusMesh,
        });
      }
      this.flightCoinLane = fromLane;
      return spanLen + 4.5;
    }

    // 4. 3-Lane V-Chevron Aerial Wedge
    const chevron: [number, number][] = [
      [1, 0],
      [0, -2.2],
      [2, -2.2],
      [0, -4.4],
      [2, -4.4],
      [1, -6.6],
      [1, -8.8],
    ];
    for (const [laneIdx, zOff] of chevron) {
      this.addSkyCoin(LANE_X[laneIdx], baseSkyY, zStart + zOff);
    }
    this.flightCoinLane = 1;
    return 13.5;
  }

  private spawnHighSkyArc(lane: number, zPad: number): void {
    const v0 = 22.0;
    const g = 40.0;
    const totalTime = (2 * v0) / g;
    const estSpeed = Math.max(BASE_SPEED, this.speed);
    const baseY = this.getWorldGroundY(this.distance + Math.max(0, -zPad));
    for (let k = 1; k <= 7; k++) {
      const tArc = (k / 8) * totalTime;
      const z = zPad - 0.5 - estSpeed * tArc;
      const localY = Math.max(0.4, v0 * tArc - 0.5 * g * tArc * tArc - 0.25);
      const y = baseY + localY;
      const mesh = this.acquireCoin();
      mesh.position.set(LANE_X[lane], y, z);
      this.scene.add(mesh);
      this.coins.push({ lane, z, y, localY, mesh });
    }
  }

  private spawnRandomPowerup(lane: number, z: number, preferLight: boolean): void {
    const spawnWorldDist = this.distance + Math.max(0, -z);
    if (spawnWorldDist - this.lastPowerupSpawnDist < 42) {
      return;
    }

    const jetpackEligible =
      this.wingsTimer <= 0 &&
      spawnWorldDist >= 90 &&
      spawnWorldDist - this.lastJetpackSpawnDist >= 190;

    const pool: PowerupType[] = preferLight
      ? jetpackEligible
        ? ['flashlight', 'flashlight', 'flashlight', 'magnet', 'shield', 'turbo', 'wings']
        : ['flashlight', 'flashlight', 'magnet', 'shield', 'turbo']
      : jetpackEligible
        ? ['magnet', 'magnet', 'shield', 'shield', 'turbo', 'turbo', 'flashlight', 'wings']
        : ['magnet', 'shield', 'turbo', 'flashlight'];

    const type = pool[Math.floor(Math.random() * pool.length)];
    const mesh = this.acquirePowerup(type);
    const baseY = this.getWorldGroundY(spawnWorldDist);
    mesh.position.set(LANE_X[lane], baseY, z);
    this.scene.add(mesh);
    this.powerups.push({ type, lane, z, baseY, mesh });

    this.lastPowerupSpawnDist = spawnWorldDist;
    if (type === 'wings') {
      this.lastJetpackSpawnDist = spawnWorldDist;
    }
  }

  // --- Loop ---

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.phase === 'playing') {
        this.pause();
      }
    } else {
      this.lastFrameMs = performance.now();
    }
  };

  private startLoop(): void {
    this.lastFrameMs = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;

      const elapsedMs = now - this.lastFrameMs;
      this.lastFrameMs = now;
      const dt = Math.min(Math.max(elapsedMs / 1000, 0), 0.05);
      this.update(dt);

      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(tick);
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    if (this.phase === 'paused') return;
    this.simTime += dt;
    const t = this.simTime;

    if (this.phase === 'menu') {
      const targetShowcaseX = this.shopPreviewOpen
        ? this.camera.aspect < 0.78
          ? -1.32
          : -1.75
        : 0;
      this.menuShowcaseX = THREE.MathUtils.damp(
        this.menuShowcaseX,
        targetShowcaseX,
        10,
        dt,
      );

      this.pedestalGroup.position.set(this.menuShowcaseX, 0, MENU_SHOWCASE_Z);
      this.pedestalGroup.rotation.y += dt * 0.35;

      // Single crisp front-facing 3D character standing squarely on the pedestal!
      if (this.menuTapTimer > 0) {
        this.menuTapTimer = Math.max(0, this.menuTapTimer - dt);
      }
      const tapFactor = this.menuTapTimer > 0 ? Math.sin((this.menuTapTimer / 0.65) * Math.PI) : 0;
      const idleBob = Math.sin(t * 2.6) * 0.035 + tapFactor * 0.14;
      this.playerRig.root.position.set(this.menuShowcaseX, 0.27 + idleBob, MENU_SHOWCASE_Z);
      this.playerRig.root.rotation.set(
        0,
        Math.PI + this.menuSpinYaw + Math.sin(t * 0.85) * 0.14,
        0,
      );
      this.playerRig.rollPivot.rotation.set(0, 0, 0);
      this.playerRig.rollPivot.position.set(0, 0.85, 0);
      this.playerRig.bodyGroup.rotation.set(0, 0, 0);

      this.playerShadow.position.set(this.menuShowcaseX, 0.285, MENU_SHOWCASE_Z);
      this.playerShadow.scale.setScalar(0.88 - tapFactor * 0.08);

      this.playerRig.headGroup.rotation.y = Math.sin(t * 1.4) * 0.12 + tapFactor * 0.22;
      this.playerRig.leftArm.rotation.x = Math.sin(t * 2.6) * 0.16 - 0.12 - tapFactor * 1.15;
      this.playerRig.rightArm.rotation.x = -Math.sin(t * 2.6) * 0.16 - 0.08 - tapFactor * 0.65;
      this.playerRig.leftLeg.rotation.x = 0;
      this.playerRig.rightLeg.rotation.x = 0;
      this.playerRig.leftAntenna.rotation.x = Math.sin(t * 4.8) * 0.12;
      this.playerRig.rightAntenna.rotation.x = Math.cos(t * 4.8) * 0.12;

      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        Math.sin(t * 0.35) * 0.12,
        6,
        dt,
      );
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 2.45, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        this.shopPreviewOpen ? 6.95 : 6.75,
        6,
        dt,
      );
      this.camera.lookAt(0, 1.24, MENU_SHOWCASE_Z);
      return;
    }

    if (this.phase === 'gameover') {
      this.crashTimer += dt;
      if (this.broomMesh.visible) {
        this.broomMesh.position.x = THREE.MathUtils.damp(
          this.broomMesh.position.x,
          -2.2,
          7,
          dt,
        );
        this.broomMesh.rotation.z = Math.sin(this.crashTimer * 14) * 0.14;
      }
      if (this.cameraShake > 0) {
        this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
        this.camera.position.x =
          (Math.sin(t * 48) * 0.65 + Math.cos(t * 73) * 0.35) * this.cameraShake * 0.5;
        this.camera.position.y =
          4.7 + (Math.cos(t * 53) * 0.65 + Math.sin(t * 67) * 0.35) * this.cameraShake * 0.5;
      }
      return;
    }

    // --- Playing State (Frame-rate independent sub-stepped simulation for 60 / 120 / 240+ FPS parity) ---
    const subSteps = Math.min(3, Math.max(1, Math.ceil(dt / MAX_SIM_STEP)));
    const subDt = dt / subSteps;
    const prevFrameX = this.playerX;
    let frameDz = 0;

    for (let step = 0; step < subSteps; step++) {
      const turboBoost = this.turboTimer > 0 ? 1.4 : this.wingsTimer > 0 ? 1.25 : 1.0;
      const baseTargetSpeed = Math.min(
        MAX_SPEED,
        BASE_SPEED + this.distance * 0.011,
      );
      this.speed = THREE.MathUtils.damp(
        this.speed,
        baseTargetSpeed * turboBoost,
        5,
        subDt,
      );

      const dz = this.speed * subDt;
      frameDz += dz;
      this.distance += dz;
      this.metrics.distance = Math.floor(this.distance);
      this.metrics.coins = this.runCoins;

      if (this.comboTimer > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - subDt);
        if (this.comboTimer <= 0) this.combo = 1;
      }

      const activeMult =
        (this.flashlightTimer > 0 ? 2 : 1) *
        (this.turboTimer > 0 ? 2 : 1) *
        this.bonusMultiplier *
        (1 + (this.combo - 1) * 0.25);
      this.score += dz * 1.4 * activeMult;

      // 3D "REKOR" Finish Gate once surpassing previous high score (>= 100)
      if (
        this.highScore >= 100 &&
        !this.isNewRecord &&
        this.score > this.highScore &&
        !this.recordGateActive
      ) {
        this.isNewRecord = true;
        this.recordGateActive = true;
        this.recordGateZ = -58;
        this.recordGateMesh.position.set(0, 0, this.recordGateZ);
        this.recordGateMesh.visible = true;
        gameAudio.playNewRecord();
      }
      if (this.recordGateActive) {
        this.recordGateZ += dz;
        this.recordGateMesh.position.z = this.recordGateZ;
        if (!this.recordGatePassed && this.recordGateZ >= 0) {
          this.recordGatePassed = true;
          this.spawnBurst(0, 3.2, -1, 0xfbbf24, 18, 6.2);
          this.spawnBurst(this.playerX, this.playerY + 1.4, 0, 0x38bdf8, 12, 5.2);
        }
        if (this.recordGateZ > 15) {
          this.recordGateMesh.visible = false;
          this.recordGateActive = false;
        }
      }

      // Dynamic Full-World Biome Transitions every exact 1,000m
      const nextZoneIdx = this.getZoneIndexForWorldDist(this.distance);
      if (nextZoneIdx !== this.zoneIndex) {
        const prevZone = ZONES[this.zoneIndex];
        this.zoneIndex = nextZoneIdx;
        const newZone = ZONES[this.zoneIndex];
        if (!this.metrics.zonesReached.includes(newZone.id)) {
          this.metrics.zonesReached.push(newZone.id);
        }
        const usesMist =
          prevZone.id !== 'yeralti_magarasi' && newZone.id !== 'yeralti_magarasi';
        if (usesMist) {
          this.biomeRevealTimer = TRANSITION_OUT_SECONDS;
        }
        gameAudio.setZoneAmbience(newZone.ambienceType);
        gameAudio.playZoneTransition();
        this.callbacks.onZoneChange(newZone);
        this.applyZoneVisuals(newZone, false);

        if (newZone.id === 'yeralti_magarasi') this.triggerDialogue('earth_zone');
        else if (newZone.id === 'buzul_dunyasi') this.triggerDialogue('ice_zone');
        else if (newZone.id === 'ates_diyari') this.triggerDialogue('fire_zone');
        else if (newZone.id === 'dev_mutfak') this.triggerDialogue('kitchen_zone');
        else if (newZone.id === 'kopuklu_banyo') this.triggerDialogue('bath_zone');
        else if (newZone.id === 'cilgin_lab') this.triggerDialogue('lab_zone');
        else if (newZone.id === 'peynir_galaksisi') this.triggerDialogue('space_zone');
        else if (newZone.id === 'mahalle_caddesi') this.triggerDialogue('street_zone');
      }

      if (this.biomeRevealTimer > 0) {
        this.biomeRevealTimer = Math.max(0, this.biomeRevealTimer - subDt);
      }
      if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - subDt);
      if (this.flashlightTimer > 0) {
        this.flashlightTimer = Math.max(0, this.flashlightTimer - subDt);
      }
      if (this.turboTimer > 0) this.turboTimer = Math.max(0, this.turboTimer - subDt);

      const wasFlying = this.wingsTimer > 0;
      if (this.wingsTimer > 0) {
        this.wingsTimer = Math.max(0, this.wingsTimer - subDt);
        if (this.wingsTimer <= 0 && wasFlying) {
          this.invulnTimer = Math.max(this.invulnTimer, 1.6);
          for (let i = this.coins.length - 1; i >= 0; i--) {
            if (this.coins[i].isSkyCoin && this.coins[i].z < -6) {
              this.releaseCoin(this.coins[i]);
              this.coins.splice(i, 1);
            }
          }
        }
      }

      if (this.stumbleTimer > 0) {
        this.stumbleTimer = Math.max(0, this.stumbleTimer - subDt);
      }
      if (this.springSafeTimer > 0) {
        this.springSafeTimer = Math.max(0, this.springSafeTimer - subDt);
      }
      if (this.springArcPullTimer > 0) {
        this.springArcPullTimer = Math.max(0, this.springArcPullTimer - subDt);
      }
      if (this.invulnTimer > 0) {
        this.invulnTimer = Math.max(0, this.invulnTimer - subDt);
      }

      const targetX = LANE_X[this.targetLane];
      this.playerX = THREE.MathUtils.damp(this.playerX, targetX, 22, subDt);

      const stepZone = ZONES[this.zoneIndex];
      const stepFlying = this.wingsTimer > 0;
      const recycleThreshold = SEGMENT_LENGTH;
      const totalLength = SEGMENT_LENGTH * SEGMENT_COUNT;
      const cutoffZ = QUALITY_PROFILES[this.graphicsQuality].segmentCutoffZ;
      for (const seg of this.segments) {
        seg.group.position.z += dz;
        if (seg.group.position.z > recycleThreshold) {
          seg.group.position.z -= totalLength;
          this.updateSegmentBiome(
            seg,
            this.distance - seg.group.position.z,
            stepZone.buildingTint,
          );
        }
        seg.group.visible = seg.biomeVisible && seg.group.position.z >= cutoffZ;
        seg.skywayGroup.visible =
          stepFlying && seg.group.visible && seg.activeZoneId !== 'yeralti_magarasi';
      }

      this.nextSpawnZ += dz;
      while (this.nextSpawnZ > -150) {
        const gap = this.spawnPattern(this.nextSpawnZ - 20);
        this.nextSpawnZ -= gap;
      }

      if (this.wingsTimer > 1.7) {
        this.nextFlightCoinZ += dz;
        while (this.nextFlightCoinZ > -74) {
          const gap = this.spawnSkyFlightFormation(this.nextFlightCoinZ);
          this.nextFlightCoinZ -= gap;
        }
      }

      this.nextTrafficWaveZ += dz;
      const waveWorldDist = this.distance + 118;
      const waveZone = ZONES[this.getZoneIndexForWorldDist(waveWorldDist)];
      const waveDistInZone = waveWorldDist % ZONE_DISTANCE;
      if (
        waveZone.id === 'mahalle_caddesi' &&
        waveDistInZone >= 35 &&
        waveDistInZone <= ZONE_DISTANCE - 95 &&
        this.distance > 70 &&
        this.nextTrafficWaveZ > -112
      ) {
        const spawned = this.spawnTrafficRushWave(-118);
        this.nextTrafficWaveZ = spawned ? -142 - Math.random() * 24 : -120;
      }

      const stepFloorY = this.getWorldGroundY(this.distance);
      let groundHeight = stepFloorY;
      const movingVehicles: ActiveObstacle[] = [];

      for (let i = 0; i < this.obstacles.length; i++) {
        const obs = this.obstacles[i];
        if (obs.kind === 'moving_taxi') {
          movingVehicles.push(obs);
          continue;
        }
        obs.z += dz;
        obs.mesh.position.z = obs.z;

        if (
          obs.kind === 'tire' ||
          obs.kind === 'snow_ball' ||
          obs.kind === 'fire_barrel' ||
          obs.kind === 'rolling_pin' ||
          obs.kind === 'tomato_ball' ||
          obs.kind === 'tp_roll' ||
          obs.kind === 'space_meteor'
        ) {
          const spinTarget =
            (obs.mesh.userData.spinPivot as THREE.Object3D | undefined) ?? obs.mesh;
          spinTarget.rotation.x += subDt * 4.5;
        } else if (obs.kind === 'bus_ramp' || obs.kind === 'terrain_ramp') {
          const laneDist = Math.abs(this.playerX - LANE_X[obs.lane]);
          const localZ = -obs.z;
          if (laneDist < 1.08 && localZ >= -3.65 && localZ <= 4.0) {
            const surfaceY =
              obs.baseY +
              (localZ >= 1.4
                ? THREE.MathUtils.clamp((3.95 - localZ) / 2.55, 0, 1) * BUS_ROOF_Y
                : BUS_ROOF_Y);
            const isOnFrontSlope = localZ >= 1.25;
            if (isOnFrontSlope || this.playerY >= surfaceY - 0.92) {
              groundHeight = Math.max(groundHeight, surfaceY);
              if (localZ < 1.4 && !obs.roofCredited) {
                obs.roofCredited = true;
                this.bumpCombo(30);
              }
            }
          }
        }
      }

      // Process moving vehicles front-to-back (largest z first), strictly straight in their assigned lane
      // with smooth bumper-to-bumper safety clamping so zero clipping ever occurs.
      if (movingVehicles.length > 1) {
        movingVehicles.sort((a, b) => b.z - a.z);
      }
      for (let v = 0; v < movingVehicles.length; v++) {
        const obs = movingVehicles[v];
        const laneX = LANE_X[obs.lane];
        let vSpeed = obs.trafficSpeed ?? 9.5;

        let blocker: ActiveObstacle | null = null;
        for (let j = 0; j < this.obstacles.length; j++) {
          const other = this.obstacles[j];
          if (other.id === obs.id || other.lane !== obs.lane) continue;
          if (other.z > obs.z - 0.4 && (!blocker || other.z < blocker.z)) {
            blocker = other;
          }
        }

        let desiredSpeed = 9.5;
        let blockerSpeed = 0;
        if (blocker) {
          const gap = blocker.z - blocker.halfDepth - (obs.z + obs.halfDepth);
          blockerSpeed =
            blocker.kind === 'moving_taxi' ? (blocker.trafficSpeed ?? 9.5) : 0;
          const safeGap = 2.8;
          const brakeDist = 16.0;
          if (gap <= safeGap) {
            desiredSpeed = Math.min(9.5, blockerSpeed);
          } else if (gap < brakeDist) {
            const ratio = (gap - safeGap) / (brakeDist - safeGap);
            desiredSpeed = blockerSpeed + (9.5 - blockerSpeed) * (ratio * ratio);
          }
        }

        const aheadWorldDist = this.distance + Math.max(0, -(obs.z + 4.5));
        if (this.getWorldGroundY(aheadWorldDist) < obs.baseY - 0.15) {
          desiredSpeed = 0;
        }

        const accelRate = desiredSpeed < vSpeed ? 15 : 5;
        vSpeed = THREE.MathUtils.damp(vSpeed, desiredSpeed, accelRate, subDt);
        obs.z += dz + vSpeed * subDt;

        if (blocker) {
          const maxAllowedZ = blocker.z - blocker.halfDepth - 2.6 - obs.halfDepth;
          if (obs.z > maxAllowedZ) {
            obs.z = maxAllowedZ;
            vSpeed = Math.min(vSpeed, blockerSpeed);
          }
        }
        obs.trafficSpeed = vSpeed;
        obs.visualX = laneX;
        obs.mesh.position.set(laneX, obs.baseY, obs.z);
        obs.mesh.rotation.y = 0;

        const wheels = obs.mesh.userData.wheels as THREE.Mesh[] | undefined;
        if (wheels) {
          const spin = ((this.speed + vSpeed) * subDt) / 0.32;
          for (let w = 0; w < wheels.length; w++) {
            wheels[w].rotation.x += spin;
          }
        }
      }
      this.currentGroundY = groundHeight;

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - subDt);
      }
      if (this.rollBufferTimer > 0) {
        this.rollBufferTimer = Math.max(0, this.rollBufferTimer - subDt);
      }
      if (this.longJumpSpinTimer > 0) {
        this.longJumpSpinTimer = Math.max(0, this.longJumpSpinTimer - subDt);
      }

      if (this.wingsTimer > 0) {
        const hoverOffset = this.getFlightHoverOffset(this.distance);
        this.playerY = THREE.MathUtils.damp(
          this.playerY,
          stepFloorY + hoverOffset + Math.sin(t * 4.0) * 0.2,
          6.0,
          subDt,
        );
        this.velY = 0;
        this.isGrounded = false;
        this.rollTimer = 0;
      } else if (!this.isGrounded || this.playerY > this.currentGroundY + 0.04) {
        // Exact Velocity-Verlet integration so jump apex and arc are identical at 60/120/240+ FPS
        const prevVelY = this.velY;
        this.velY -= 40 * subDt;
        this.playerY += 0.5 * (prevVelY + this.velY) * subDt;
        if (this.playerY <= this.currentGroundY) {
          this.playerY = this.currentGroundY;
          this.velY = 0;
          this.isGrounded = true;
          this.longJumpSpinTimer = 0;
          this.landSquashTimer = 0.09;
          this.spawnBurst(this.playerX, this.playerY + 0.15, 0.1, 0xe2e8f0, 5, 2.5);
          if (this.rollBufferTimer > 0) {
            this.executeRoll();
          } else if (this.jumpBufferTimer > 0) {
            this.executeJump();
          }
        }
      } else {
        this.playerY = this.currentGroundY;
        this.isGrounded = true;
      }

      if (this.landSquashTimer > 0) {
        this.landSquashTimer = Math.max(0, this.landSquashTimer - subDt);
      }
      if (this.rollTimer > 0) {
        this.rollTimer = Math.max(0, this.rollTimer - subDt);
      }

      const stepRolling = this.rollTimer > 0 && this.isGrounded;
      const playerBottom = this.playerY;
      const playerTop = this.playerY + (stepRolling ? 0.95 : 1.9);

      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        const inZRange = Math.abs(obs.z) < obs.halfDepth + 0.24;
        const obsX = obs.visualX ?? LANE_X[obs.lane];
        const laneDist = Math.abs(this.playerX - obsX);

        if (obs.kind === 'spring_pad') {
          if (
            !obs.impactDone &&
            Math.abs(obs.z) < 1.35 &&
            laneDist < 1.05 &&
            playerBottom < obs.baseY + 1.35
          ) {
            obs.impactDone = true;
            this.velY = 22.0;
            this.isGrounded = false;
            this.rollTimer = 0;
            this.longJumpSpinTimer = 1.05;
            this.springArcPullTimer = 1.35;
            this.springSafeTimer = 1.6;
            gameAudio.playSpringLaunch();
            this.bumpCombo(40);
            this.spawnBurst(this.playerX, this.playerY + 0.4, 0, 0x38bdf8, 12, 4.5);
          }
        } else if (obs.kind === 'bus_ramp' || obs.kind === 'terrain_ramp') {
          const localZ = -obs.z;
          if (laneDist < 0.86 && localZ >= -3.4 && localZ < 1.25) {
            const surfaceY = obs.baseY + BUS_ROOF_Y;
            if (
              playerBottom < surfaceY - 0.92 &&
              this.invulnTimer <= 0 &&
              this.springSafeTimer <= 0 &&
              this.turboTimer <= 0 &&
              this.wingsTimer <= 0
            ) {
              if (this.hasShield) {
                this.breakShield(obs, i);
                continue;
              } else {
                this.handleCrash(obs.kind);
                return;
              }
            }
          }
        } else if (inZRange && laneDist < 0.82) {
          const yOverlap =
            playerBottom < obs.baseY + obs.height && playerTop > obs.baseY + obs.minY;

          if (
            yOverlap &&
            this.invulnTimer <= 0 &&
            this.springSafeTimer <= 0 &&
            this.turboTimer <= 0 &&
            this.wingsTimer <= 0
          ) {
            if (this.hasShield) {
              this.breakShield(obs, i);
              continue;
            }
            if (
              (obs.kind === 'cone' ||
                obs.kind === 'tire' ||
                obs.kind === 'mushroom_cluster' ||
                obs.kind === 'fire_barrel' ||
                obs.kind === 'tomato_ball' ||
                obs.kind === 'tp_roll' ||
                obs.kind === 'jelly_cube' ||
                obs.kind === 'space_meteor') &&
              this.stumbleTimer <= 0
            ) {
              this.stumbleTimer = 5.0;
              this.invulnTimer = 0.85;
              this.cameraShake = 0.42;
              this.combo = 1;
              this.comboTimer = 0;
              gameAudio.playStumble();
              this.spawnBurst(this.playerX, this.playerY + 0.6, 0, 0xf97316, 10, 4.0);
              this.releaseObstacle(obs);
              this.obstacles.splice(i, 1);
              continue;
            }
            this.handleCrash(obs.kind);
            return;
          }
        } else if (
          !obs.nearMissAwarded &&
          obs.z > 0.7 &&
          obs.z < 2.2 &&
          laneDist < 1.35 &&
          this.wingsTimer <= 0
        ) {
          obs.nearMissAwarded = true;
          this.metrics.nearMisses += 1;
          this.bumpCombo(25);
          if (Math.random() < 0.25) {
            this.triggerDialogue('near_miss');
          }
        }

        if (obs.z > 12) {
          this.releaseObstacle(obs);
          this.obstacles.splice(i, 1);
        }
      }

      // Simit coins
      for (let i = this.coins.length - 1; i >= 0; i--) {
        const coin = this.coins[i];
        coin.z += dz;
        coin.mesh.rotation.y += subDt * 3.5;

        const isSpringArcPull =
          this.springArcPullTimer > 0 &&
          !coin.isSkyCoin &&
          coin.localY > 0.9 &&
          coin.z > -5.5 &&
          coin.z < 3.5 &&
          Math.abs(coin.mesh.position.x - this.playerX) < 2.4;

        const magnetMatchesLayer =
          this.magnetTimer > 0 &&
          coin.z > -22 &&
          coin.z < 4 &&
          (stepFlying ? Boolean(coin.isSkyCoin) : !coin.isSkyCoin);

        if (magnetMatchesLayer || isSpringArcPull) {
          _vec3A.set(this.playerX, this.playerY + 0.85, 0);
          coin.mesh.position.lerp(
            _vec3A,
            1 - Math.exp(-(isSpringArcPull ? 18 : 12) * subDt),
          );
          coin.z = coin.mesh.position.z;
        } else {
          coin.mesh.position.z = coin.z;
        }

        const dx = coin.mesh.position.x - this.playerX;
        const dy = coin.mesh.position.y + 0.45 - (this.playerY + 0.85);
        const cz = coin.mesh.position.z;
        const distSq = dx * dx + dy * dy + cz * cz;

        const pickupThreshold = stepFlying ? 4.2 : !this.isGrounded ? 3.4 : 1.95;
        if (distSq < pickupThreshold) {
          this.runCoins += 1;
          this.score += 10 * this.combo;
          gameAudio.playCoin();
          this.spawnBurst(
            coin.mesh.position.x,
            coin.mesh.position.y + 0.35,
            coin.mesh.position.z,
            0xfbbf24,
            6,
            3.4,
          );
          this.releaseCoin(coin);
          this.coins.splice(i, 1);
          continue;
        }

        if (coin.z > 8) {
          this.releaseCoin(coin);
          this.coins.splice(i, 1);
        }
      }

      // Powerups
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const p = this.powerups[i];
        p.z += dz;
        p.mesh.position.z = p.z;
        p.mesh.rotation.y += subDt * 2.5;
        p.mesh.position.y = p.baseY + Math.sin(t * 4 + i) * 0.15;

        if (
          Math.abs(p.z) < 1.35 &&
          Math.abs(LANE_X[p.lane] - this.playerX) < 1.25 &&
          Math.abs(p.baseY - this.playerY) < 2.4
        ) {
          this.activatePowerup(p.type);
          this.releasePowerup(p);
          this.powerups.splice(i, 1);
          continue;
        }

        if (p.z > 8) {
          this.releasePowerup(p);
          this.powerups.splice(i, 1);
        }
      }
    }

    // --- Per-Render-Frame Visual Updates (Smooth 60 / 120 / 240+ FPS) ---
    const currentZone = ZONES[this.zoneIndex];
    const earthNow = this.getEarthWindowForWorldDist(this.distance);
    const floorY = this.getWorldGroundY(this.distance);
    const currStage = Math.max(0, Math.floor(this.distance / ZONE_DISTANCE));
    const upcomingZone = this.getZoneConfigById(this.getZoneIdForStage(currStage + 1));
    const distInZone = this.distance % ZONE_DISTANCE;
    const isApproachingMistTransition =
      currentZone.id !== 'yeralti_magarasi' && upcomingZone.id !== 'yeralti_magarasi';
    const approachRatio = isApproachingMistTransition
      ? THREE.MathUtils.clamp(
          (distInZone - (ZONE_DISTANCE - TRANSITION_IN_METERS)) /
            TRANSITION_IN_METERS,
          0,
          1,
        )
      : 0;
    const approachSmooth = approachRatio * approachRatio * (3 - 2 * approachRatio);
    const revealRatio = this.biomeRevealTimer / TRANSITION_OUT_SECONDS;
    const revealSmooth = revealRatio * revealRatio * (3 - 2 * revealRatio);
    const rawMistEnvelope = Math.max(approachSmooth, revealSmooth);
    const isFlying = this.wingsTimer > 0;
    const mistEnvelope = isFlying ? rawMistEnvelope * 0.12 : rawMistEnvelope;

    if (this.scene.background instanceof THREE.Color) {
      if (isFlying && currentZone.id !== 'yeralti_magarasi') {
        _colorA.setHex(0x0284c7);
      } else {
        _colorA.setHex(
          approachRatio > 0.35 ? upcomingZone.fogColor : currentZone.skyColor,
        );
      }
      this.scene.background.lerp(_colorA, 1 - Math.exp(-3.6 * dt));
    }
    if (this.scene.fog instanceof THREE.Fog) {
      const stairTargetFog =
        earthNow && this.distance >= earthNow.stairStart
          ? upcomingZone.fogColor
          : currentZone.fogColor;
      const targetFogHex =
        isFlying && currentZone.id !== 'yeralti_magarasi'
          ? 0x38bdf8
          : approachRatio > 0.25
            ? upcomingZone.fogColor
            : stairTargetFog;
      _colorA.setHex(targetFogHex);
      this.scene.fog.color.lerp(_colorA, 1 - Math.exp(-3.8 * dt));

      const profile = QUALITY_PROFILES[this.graphicsQuality];
      const isCave = currentZone.id === 'yeralti_magarasi';
      const baseNear = isFlying
        ? profile.fogNear * 1.15
        : isCave
          ? profile.fogNear * 0.62
          : profile.fogNear;
      const baseFar = isFlying
        ? profile.fogFar * 1.1
        : isCave
          ? profile.fogFar * 0.65
          : profile.fogFar;
      this.scene.fog.near = baseNear + (14 - baseNear) * mistEnvelope;
      this.scene.fog.far = baseFar + (64 - baseFar) * mistEnvelope;
    }

    const effectiveLight =
      this.flashlightTimer > 0
        ? Math.max(currentZone.lightIntensity, 0.95)
        : currentZone.lightIntensity;
    this.dirLight.intensity = THREE.MathUtils.damp(
      this.dirLight.intensity,
      effectiveLight * 1.38,
      3.5,
      dt,
    );
    this.hemiLight.intensity = THREE.MathUtils.damp(
      this.hemiLight.intensity,
      effectiveLight * 0.9,
      3.5,
      dt,
    );

    const lampActive = currentZone.isDark || this.flashlightTimer > 0;
    this.playerRig.headlampMesh.visible = lampActive;
    this.headlamp.intensity = THREE.MathUtils.damp(
      this.headlamp.intensity,
      lampActive ? 74 : 0,
      6,
      dt,
    );
    this.headlamp.visible = lampActive || this.headlamp.intensity > 0.05;

    if (this.stumbleTimer > 0) {
      this.broomMesh.visible = true;
      this.broomMesh.position.x = THREE.MathUtils.damp(
        this.broomMesh.position.x,
        this.playerX,
        8,
        dt,
      );
      this.broomMesh.position.z = 2.6 + Math.sin(t * 14) * 0.25;
      this.broomMesh.rotation.z = Math.sin(t * 12) * 0.14;
    } else {
      this.broomMesh.visible = false;
    }

    if (this.invulnTimer > 0) {
      this.playerRig.root.visible = Math.floor(this.invulnTimer * 14) % 2 === 0;
    } else {
      this.playerRig.root.visible = true;
    }
    this.playerRig.shieldSphere.visible = this.hasShield || this.turboTimer > 0;

    const lateralVel = (this.playerX - prevFrameX) / Math.max(dt, 0.001);

    this.updateBiomeGroundPositions();
    if (
      this.transitionGateMesh &&
      this.transitionGateMesh.visible &&
      !this.transitionGateBurstDone &&
      this.transitionGateMesh.position.z >= 0
    ) {
      this.transitionGateBurstDone = true;
      this.spawnBurst(0, 3.0, -0.5, currentZone.lampColor, 14, 5.5);
    }
    for (const seg of this.segments) {
      if (seg.group.visible && seg.biomeGroups.mahalle_caddesi.visible) {
        for (const spec of seg.spectators) {
          spec.position.y =
            0.22 + Math.abs(Math.sin(t * 6 + seg.group.position.z)) * 0.22;
        }
      }
    }
    const isRolling = this.rollTimer > 0 && this.isGrounded;

    this.playerRig.root.position.set(this.playerX, this.playerY, 0);
    this.playerRig.root.rotation.y = 0;
    this.playerShadow.position.set(this.playerX, this.currentGroundY + 0.02, 0);
    this.playerShadow.scale.setScalar(
      Math.max(0.35, 1 - (this.playerY - this.currentGroundY) * 0.12),
    );

    this.headlamp.position.set(this.playerX, this.playerY + 1.65, -0.4);
    this.headlampTarget.position.set(this.playerX, floorY + 0.4, -24);

    // Subway Surfers Twin-Rocket Jetpack Visibility & Flame Pulse
    this.playerRig.leftWing.visible = false;
    this.playerRig.rightWing.visible = false;
    this.playerRig.jetpackGroup.visible = isFlying;
    if (isFlying) {
      const lScaleY = 0.88 + Math.random() * 0.55;
      const rScaleY = 0.88 + Math.random() * 0.55;
      this.playerRig.leftJetFlame.scale.set(
        0.92 + Math.random() * 0.22,
        lScaleY,
        0.92 + Math.random() * 0.22,
      );
      this.playerRig.rightJetFlame.scale.set(
        0.92 + Math.random() * 0.22,
        rScaleY,
        0.92 + Math.random() * 0.22,
      );
    }

    // --- Athletic Character Animation ---
    if (isFlying) {
      // Horizontal belly-down Subway Surfers Jetpack pose (face facing track, legs trailing back!)
      this.playerRig.rollPivot.rotation.x = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.x,
        -1.32,
        11,
        dt,
      );
      this.playerRig.rollPivot.rotation.z = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.z,
        -lateralVel * 0.042,
        14,
        dt,
      );
      this.playerRig.rollPivot.position.y = THREE.MathUtils.damp(
        this.playerRig.rollPivot.position.y,
        0.92,
        14,
        dt,
      );
      this.playerRig.bodyGroup.rotation.x = 0;
      this.playerRig.bodyGroup.rotation.z = 0;
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        0.48,
        10,
        dt,
      );
      this.playerRig.leftArm.rotation.x = -2.42;
      this.playerRig.rightArm.rotation.x = -2.42;
      this.playerRig.leftArm.rotation.z = -0.26;
      this.playerRig.rightArm.rotation.z = 0.26;
      const flutter = Math.sin(t * 14) * 0.14;
      this.playerRig.leftLeg.rotation.x = 0.12 + flutter;
      this.playerRig.rightLeg.rotation.x = 0.12 - flutter;
    } else if (this.longJumpSpinTimer > 0 && !this.isGrounded) {
      // Acrobatic Super-Spring Flip!
      const spinProgress = 1 - this.longJumpSpinTimer / 1.05;
      this.playerRig.rollPivot.rotation.x = -spinProgress * Math.PI * 2;
      this.playerRig.rollPivot.rotation.z = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.z,
        0,
        16,
        dt,
      );
      this.playerRig.rollPivot.position.y = 0.85;
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        0,
        16,
        dt,
      );
      this.playerRig.leftLeg.rotation.x = 0.9;
      this.playerRig.rightLeg.rotation.x = 0.9;
      this.playerRig.leftArm.rotation.x = -1.2;
      this.playerRig.rightArm.rotation.x = -1.2;
      this.playerRig.leftArm.rotation.z = 0;
      this.playerRig.rightArm.rotation.z = 0;
    } else if (isRolling) {
      // Real 360° Forward Somersault Parkour Roll!
      const rollProgress = 1 - this.rollTimer / ROLL_DURATION;
      this.playerRig.rollPivot.rotation.x = -rollProgress * Math.PI * 2;
      this.playerRig.rollPivot.rotation.z = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.z,
        0,
        16,
        dt,
      );
      this.playerRig.rollPivot.position.y = THREE.MathUtils.damp(
        this.playerRig.rollPivot.position.y,
        0.52,
        24,
        dt,
      );
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        0,
        18,
        dt,
      );
      this.playerRig.leftLeg.rotation.x = 1.25;
      this.playerRig.rightLeg.rotation.x = 1.25;
      this.playerRig.leftArm.rotation.x = 1.1;
      this.playerRig.rightArm.rotation.x = 1.1;
      this.playerRig.leftArm.rotation.z = 0;
      this.playerRig.rightArm.rotation.z = 0;
      this.playerRig.bodyGroup.rotation.x = 0;
      this.playerRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
        this.playerRig.bodyGroup.rotation.z,
        -lateralVel * 0.02,
        16,
        dt,
      );
    } else if (!this.isGrounded) {
      this.playerRig.rollPivot.rotation.x = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.x,
        0,
        18,
        dt,
      );
      this.playerRig.rollPivot.rotation.z = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.z,
        0,
        18,
        dt,
      );
      this.playerRig.rollPivot.position.y = THREE.MathUtils.damp(
        this.playerRig.rollPivot.position.y,
        0.85,
        18,
        dt,
      );
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        0,
        16,
        dt,
      );
      const airPitch = THREE.MathUtils.clamp(this.velY * 0.02, -0.22, 0.24);
      this.playerRig.bodyGroup.rotation.x = airPitch;
      this.playerRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
        this.playerRig.bodyGroup.rotation.z,
        -lateralVel * 0.024,
        16,
        dt,
      );
      this.playerRig.leftLeg.rotation.x = 0.85;
      this.playerRig.rightLeg.rotation.x = -0.55;
      this.playerRig.leftArm.rotation.x = -1.1;
      this.playerRig.rightArm.rotation.x = 0.75;
      this.playerRig.leftArm.rotation.z = 0;
      this.playerRig.rightArm.rotation.z = 0;
    } else {
      this.playerRig.rollPivot.rotation.x = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.x,
        0,
        22,
        dt,
      );
      this.playerRig.rollPivot.rotation.z = THREE.MathUtils.damp(
        this.playerRig.rollPivot.rotation.z,
        0,
        22,
        dt,
      );
      const landDip = this.landSquashTimer > 0 ? -0.14 : 0;
      this.playerRig.rollPivot.position.y = THREE.MathUtils.damp(
        this.playerRig.rollPivot.position.y,
        0.85 + landDip,
        24,
        dt,
      );
      this.playerRig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.headGroup.rotation.x,
        0,
        18,
        dt,
      );
      this.playerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(
        this.playerRig.bodyGroup.rotation.x,
        -0.16,
        14,
        dt,
      );
      this.playerRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
        this.playerRig.bodyGroup.rotation.z,
        -lateralVel * 0.026,
        18,
        dt,
      );

      this.runAnimPhase += dt * this.speed * 0.92;
      const swing = Math.sin(this.runAnimPhase);
      this.playerRig.leftArm.rotation.x = swing * 0.95;
      this.playerRig.rightArm.rotation.x = -swing * 0.95;
      this.playerRig.leftArm.rotation.z = 0;
      this.playerRig.rightArm.rotation.z = 0;
      this.playerRig.leftLeg.rotation.x = -swing * 1.05;
      this.playerRig.rightLeg.rotation.x = swing * 1.05;
    }

    // Emit twin-nozzle phosphor smoke plumes at a fixed 60 Hz cadence so 60 FPS and 240+ FPS match cleanly
    if (isFlying) {
      const jetInterval =
        this.graphicsQuality === 'low' ? JET_EXHAUST_INTERVAL * 2 : JET_EXHAUST_INTERVAL;
      this.jetExhaustEmitAccum = Math.min(
        this.jetExhaustEmitAccum + dt,
        jetInterval * 2,
      );
      if (this.jetExhaustEmitAccum >= jetInterval) {
        this.playerRig.root.updateMatrixWorld(true);
        const plumesPerNozzle = this.graphicsQuality === 'low' ? 1 : 2;
        while (this.jetExhaustEmitAccum >= jetInterval) {
          this.jetExhaustEmitAccum -= jetInterval;
          this.playerRig.leftNozzleTip.getWorldPosition(_vec3A);
          for (let p = 0; p < plumesPerNozzle; p++) {
            this.emitJetExhaust(_vec3A.x, _vec3A.y, _vec3A.z, lateralVel);
          }
          this.playerRig.rightNozzleTip.getWorldPosition(_vec3A);
          for (let p = 0; p < plumesPerNozzle; p++) {
            this.emitJetExhaust(_vec3A.x, _vec3A.y, _vec3A.z, lateralVel);
          }
        }
      }
    } else {
      this.jetExhaustEmitAccum = 0;
    }

    this.playerRig.leftAntenna.rotation.x = Math.sin(t * 14) * 0.16;
    this.playerRig.rightAntenna.rotation.x = Math.cos(t * 14) * 0.16;

    this.updateParticles(dt);
    this.updateJetExhaust(dt);
    this.updateBiomeParticles(dt, currentZone.id, frameDz, t, floorY);

    // Periodic dialogues
    this.dialogueTimer -= dt;
    if (this.dialogueTimer <= 0) {
      this.dialogueTimer = 8.5 + Math.random() * 4.5;
      this.triggerDialogue('random');
    }

    // Crisp Subway Surfers camera (natural FOV without VR fisheye warping!)
    const baseFov = this.camera.aspect < 0.85 ? 54 : 45;
    const speedFov = Math.min(2.2, Math.max(0, (this.speed - BASE_SPEED) * 0.12));
    const targetFov =
      baseFov +
      speedFov +
      (this.turboTimer > 0 ? 3.0 : isFlying ? 1.5 : 0);
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.002) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const shakeX =
      this.cameraShake > 0
        ? (Math.sin(t * 48) * 0.65 + Math.cos(t * 73) * 0.35) * this.cameraShake * 0.5
        : 0;
    const shakeY =
      this.cameraShake > 0
        ? (Math.cos(t * 53) * 0.65 + Math.sin(t * 67) * 0.35) * this.cameraShake * 0.5
        : 0;
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 2);

    const relY = Math.max(0, this.playerY - floorY);
    const slopeLookOffset =
      earthNow && this.distance < earthNow.descentEnd
        ? -0.95
        : earthNow && this.distance >= earthNow.stairStart
          ? 1.15
          : 0;

    const targetCamX = this.playerX * (isFlying ? 0.54 : 0.34);
    const targetCamY = isFlying
      ? this.playerY + 3.15
      : floorY + 4.85 + relY * 0.52;
    const targetCamZ = isFlying ? 6.95 : 8.0;
    const lookTargetY = isFlying
      ? this.playerY - 1.75 + slopeLookOffset
      : floorY + 1.35 + relY * 0.45 + slopeLookOffset;
    const lookTargetZ = isFlying ? -16 : -14;

    this.camera.position.x =
      THREE.MathUtils.damp(this.camera.position.x, targetCamX, 10, dt) + shakeX;
    this.camera.position.y =
      THREE.MathUtils.damp(this.camera.position.y, targetCamY, 7.5, dt) + shakeY;
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      targetCamZ,
      7.5,
      dt,
    );
    this.camera.lookAt(
      this.playerX * (isFlying ? 0.35 : 0.24),
      lookTargetY,
      lookTargetZ,
    );

    this.hudThrottle += dt;
    if (this.hudThrottle >= 0.1) {
      this.hudThrottle = 0;
      this.emitHud();
    }
  }

  private bumpCombo(points: number): void {
    this.combo = Math.min(6, this.combo + 1);
    this.comboTimer = 4.2;
    this.score += points * this.combo;
  }

  private breakShield(obs: ActiveObstacle, index: number): void {
    this.hasShield = false;
    this.invulnTimer = 1.4 + (this.upgrades.shield - 1) * 0.35;
    gameAudio.playShieldBreak();
    this.triggerDialogue('shield_break');
    this.releaseObstacle(obs);
    this.obstacles.splice(index, 1);
  }

  private activatePowerup(type: PowerupType): void {
    this.metrics.powerups += 1;
    gameAudio.playPowerup();
    if (type === 'magnet') {
      this.metrics.magnets += 1;
      this.magnetTimer = 8.0 + (this.upgrades.magnet - 1) * 1.5;
      this.triggerDialogue('magnet');
    } else if (type === 'shield') {
      this.metrics.shields += 1;
      this.hasShield = true;
    } else if (type === 'flashlight') {
      this.metrics.flashlights += 1;
      this.flashlightTimer = 9.0 + (this.upgrades.flashlight - 1) * 1.5;
      this.triggerDialogue('flashlight');
    } else if (type === 'turbo') {
      this.metrics.turbos += 1;
      this.turboTimer = 4.0 + (this.upgrades.turbo - 1) * 0.75;
    } else if (type === 'wings') {
      this.wingsTimer = 6.5 + (this.upgrades.wings - 1) * 1.1;
      this.metrics.flights += 1;
      this.flightCoinLane = this.targetLane;
      this.skyPatternIndex = Math.floor(Math.random() * 4);
      const firstGap = this.spawnSkyFlightFormation(-28);
      this.nextFlightCoinZ = -28 - firstGap;
      this.spawnBurst(this.playerX, this.playerY + 0.8, 0.2, 0x39ff14, 10, 3.6);
      gameAudio.playWingsFlap();
    }
    this.emitHud();
  }

  private handleCrash(kind: ObstacleKind): void {
    this.phase = 'gameover';
    this.crashTimer = 0;
    this.cameraShake = 0.65;
    this.wingsTimer = 0;
    this.stumbleTimer = 0;
    this.playerRig.leftWing.visible = false;
    this.playerRig.rightWing.visible = false;
    this.playerRig.jetpackGroup.visible = false;
    gameAudio.setPlaying(false);
    gameAudio.playCrash();

    this.deathReason = DEATH_REASONS[kind] || 'SÜPÜRGE SÜPÜRDÜ';
    const finalScore = Math.floor(this.score);
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      this.isNewRecord = true;
    }

    this.broomMesh.visible = true;
    this.broomMesh.position.set(7.5, 0, 1.2);
    this.playerRig.root.rotation.x = -Math.PI / 2.2;

    this.triggerDialogue('crash');
    const snap = this.buildSnapshot();
    this.callbacks.onHudUpdate(snap);
    this.callbacks.onGameOver(snap);
  }

  private buildSnapshot(): HudSnapshot {
    return {
      phase: this.phase,
      score: Math.floor(this.score),
      distance: Math.floor(this.distance),
      coins: this.runCoins,
      highScore: Math.max(this.highScore, Math.floor(this.score)),
      speedMultiplier: Number((this.speed / BASE_SPEED).toFixed(1)),
      combo: this.combo,
      stumbleTimer: Number(this.stumbleTimer.toFixed(1)),
      zone: ZONES[this.zoneIndex],
      activePowerups: {
        magnet: Math.ceil(this.magnetTimer),
        flashlight: Math.ceil(this.flashlightTimer),
        turbo: Math.ceil(this.turboTimer),
        wings: Math.ceil(this.wingsTimer),
        shield: this.hasShield,
      },
      deathReason: this.deathReason,
      isNewRecord: this.isNewRecord,
      continueCount: this.continueCount,
      adReviveUsed: this.adReviveUsed,
      metrics: {
        ...this.metrics,
        zonesReached: [...this.metrics.zonesReached],
      },
    };
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate(this.buildSnapshot());
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyQualityProfile();
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    gameAudio.setPlaying(false);

    this.obstaclePool.forEach((bucket) => {
      bucket.forEach((mesh) => this.removeAndDispose(mesh));
    });
    this.obstaclePool.clear();
    this.powerupPool.forEach((bucket) => {
      bucket.forEach((mesh) => this.removeAndDispose(mesh));
    });
    this.powerupPool.clear();
    this.coinPool.forEach((mesh) => this.removeAndDispose(mesh));
    this.coinPool = [];

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (obj.userData?.sharedAsset) return;
        if (!obj.userData?.sharedGeometry) {
          obj.geometry?.dispose();
        }
        if (!obj.userData?.sharedMaterial) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      }
    });
    for (const d of this.sharedDisposables) {
      d.dispose();
    }
    this.sharedDisposables = [];

    this.envMapTexture?.dispose();
    this.envMapTexture = null;
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
