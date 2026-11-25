import { projectGeo } from './campus-layout.js?v=real7';

// Landmark centers: Yonsei's public Sinchon campus map API snapshot (2026-10-13).
// Roads, boundary, planting and sports dimensions are visual estimates from the
// official 2024 plan, NOT cadastral footprints, surveyed roads or elevation data.
// The plan's graphic orientation is not north-up: all runtime points below are
// projected from geographic coordinates (east +x, south +z, .22 units / meter).
export const LANDSCAPE_SOURCE = Object.freeze({
  markers: 'https://www.yonsei.ac.kr/campusMap/sc/view.do',
  plan: 'https://designcenter.yonsei.ac.kr/designcenter/intro/campus_map.do',
  planYear: 2024,
  geometry: 'approximate plan-derived ground geometry; flat terrain, no DEM',
});
const geo = (lat, lon) => projectGeo(lat, lon);
export const LANDMARKS = Object.freeze({
  mainGate: geo(37.56051352790869,126.9368421638162),
  baekyangSouth: geo(37.561306519459436,126.93705654061662),
  fountain: geo(37.5625387265439,126.93723376887277),
  eagle: geo(37.56315826341093,126.93742566361969),
  baekyangNorth: geo(37.56431638176385,126.93806702979761),
  underwoodLawn: geo(37.56562305327228,126.93850172465677),
  underwoodStatue: geo(37.56582130028791,126.93855532647198),
  stadium: geo(37.56232039971468,126.93342248972175),
  baseball: geo(37.56148729929306,126.93399480255812),
  amphitheater: geo(37.56542538801525,126.93957434758238),
  westGate: geo(37.56382311545214,126.9339644452865),
  eastGate: geo(37.566077110097275,126.94576245289971),
  northGate: geo(37.57271846567224,126.93864304992944),
  tennis: geo(37.57273454774035,126.93925148403119),
});
// Offline-baked paths: no search/pathfinding runs during gameplay or reset.
// Control points were moved away from conservative rotated footprint envelopes.
// These remain inferred walk/road corridors, not measured road boundaries.
export const CAMPUS_PATHS = [
  {
    "id": "baekyang",
    "width": 5.5,
    "kind": "walk",
    "points": [
      {
        "x": -40.596122,
        "z": 93.535763
      },
      {
        "x": -36.439147,
        "z": 74.136903
      },
      {
        "x": -33.002518,
        "z": 43.993564
      },
      {
        "x": -29.281491,
        "z": 28.837906
      },
      {
        "x": -16.844775,
        "z": 0.506991
      },
      {
        "x": -8.415618,
        "z": -31.457962
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "west-campus",
    "width": 2.2,
    "kind": "road",
    "points": [
      {
        "x": -61.774245,
        "z": 92.154293
      },
      {
        "x": -59.15,
        "z": 92.95
      },
      {
        "x": -58.5,
        "z": 92.3
      },
      {
        "x": -54.211764,
        "z": 77.231934
      },
      {
        "x": -40.95,
        "z": 68.25
      },
      {
        "x": -37.05,
        "z": 54.6
      },
      {
        "x": -38.35,
        "z": 53.3
      },
      {
        "x": -40.3,
        "z": 53.3
      },
      {
        "x": -41.0259,
        "z": 28.061537
      },
      {
        "x": -46.8,
        "z": 19.5
      },
      {
        "x": -45.098005,
        "z": 2.620138
      },
      {
        "x": -37.7,
        "z": -0.65
      },
      {
        "x": -34.45,
        "z": -14.3
      },
      {
        "x": -37.7,
        "z": -14.95
      },
      {
        "x": -37.7,
        "z": -26.65
      },
      {
        "x": -36.4,
        "z": -29.9
      },
      {
        "x": -35.75,
        "z": -33.15
      },
      {
        "x": -18.726278,
        "z": -32.606415
      },
      {
        "x": -20.8,
        "z": -42.25
      },
      {
        "x": -19.501917,
        "z": -59.270958
      },
      {
        "x": -19.5,
        "z": -63.7
      },
      {
        "x": -27.3,
        "z": -68.25
      },
      {
        "x": -27.95,
        "z": -68.9
      },
      {
        "x": -25.35,
        "z": -76.7
      },
      {
        "x": -21.053195,
        "z": -82.999955
      },
      {
        "x": -15.235902,
        "z": -105.750437
      },
      {
        "x": 7.83936,
        "z": -110.398385
      },
      {
        "x": 20.15,
        "z": -101.4
      },
      {
        "x": 23.93387,
        "z": -91.561965
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "west-gate",
    "width": 1.8,
    "kind": "road",
    "points": [
      {
        "x": -96.397894,
        "z": 12.573708
      },
      {
        "x": -89.05,
        "z": 12.35
      },
      {
        "x": -76.7,
        "z": 15.6
      },
      {
        "x": -79.3,
        "z": 26.65
      },
      {
        "x": -88.4,
        "z": 24.05
      },
      {
        "x": -79.3,
        "z": 26.65
      },
      {
        "x": -76.05,
        "z": 21.45
      },
      {
        "x": -75.4,
        "z": 20.8
      },
      {
        "x": -66.95,
        "z": 20.8
      },
      {
        "x": -53.3,
        "z": 24.7
      },
      {
        "x": -47.618832,
        "z": 26.593764
      },
      {
        "x": -27.646127,
        "z": 25.859878
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "sports-access",
    "width": 1.2,
    "kind": "road",
    "points": [
      {
        "x": -69.142816,
        "z": 91.175778
      },
      {
        "x": -78.65,
        "z": 87.1
      },
      {
        "x": -77.868755,
        "z": 77.96582
      },
      {
        "x": -74.75,
        "z": 72.8
      },
      {
        "x": -66.3,
        "z": 67.6
      },
      {
        "x": -65.65,
        "z": 66.95
      },
      {
        "x": -63.7,
        "z": 59.8
      },
      {
        "x": -66.3,
        "z": 58.5
      },
      {
        "x": -85.625146,
        "z": 53.992194
      },
      {
        "x": -85.8,
        "z": 50.7
      },
      {
        "x": -98.15,
        "z": 29.9
      },
      {
        "x": -99.45,
        "z": 29.9
      },
      {
        "x": -105.3,
        "z": 33.8
      },
      {
        "x": -105.3,
        "z": 30.55
      },
      {
        "x": -105.95,
        "z": 29.9
      },
      {
        "x": -118.3,
        "z": 26.65
      },
      {
        "x": -127.703564,
        "z": 31.241712
      },
      {
        "x": -119.947173,
        "z": 21.21193
      },
      {
        "x": -96.397894,
        "z": 12.573708
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "east-campus",
    "width": 2.2,
    "kind": "road",
    "points": [
      {
        "x": -19.695826,
        "z": 76.253419
      },
      {
        "x": -6.703872,
        "z": 54.236823
      },
      {
        "x": 5.85,
        "z": 27.95
      },
      {
        "x": 7.15,
        "z": 20.8
      },
      {
        "x": 4.155074,
        "z": 17.542497
      },
      {
        "x": 6.5,
        "z": 4.55
      },
      {
        "x": 7.8,
        "z": 1.3
      },
      {
        "x": 9.972367,
        "z": 0.418479
      },
      {
        "x": 22.1,
        "z": -17.55
      },
      {
        "x": 21.994772,
        "z": -18.173313
      },
      {
        "x": 24.05,
        "z": -32.5
      },
      {
        "x": 20.831314,
        "z": -37.988249
      },
      {
        "x": 21.025224,
        "z": -54.378381
      },
      {
        "x": 23.352141,
        "z": -77.618121
      },
      {
        "x": 24.7,
        "z": -87.75
      },
      {
        "x": 23.93387,
        "z": -91.561965
      },
      {
        "x": 25.872968,
        "z": -107.952097
      },
      {
        "x": 27.036426,
        "z": -126.29926
      },
      {
        "x": 18.698306,
        "z": -144.157165
      },
      {
        "x": 0.858608,
        "z": -159.079524
      },
      {
        "x": -0.30485,
        "z": -175.469656
      },
      {
        "x": -10.194248,
        "z": -188.434985
      },
      {
        "x": -8.45,
        "z": -197.6
      },
      {
        "x": -5.675183,
        "z": -205.032212
      },
      {
        "x": -6.122143,
        "z": -215.588786
      },
      {
        "x": -7.479511,
        "z": -231.978918
      },
      {
        "x": -7.479511,
        "z": -243.231845
      },
      {
        "x": -7.091692,
        "z": -251.304596
      },
      {
        "x": -1.3,
        "z": -258.05
      },
      {
        "x": 9.002818,
        "z": -260.600492
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "international-district",
    "width": 2.0,
    "kind": "road",
    "points": [
      {
        "x": 21.994772,
        "z": -18.173313
      },
      {
        "x": 41.967478,
        "z": -14.503881
      },
      {
        "x": 42.25,
        "z": -16.9
      },
      {
        "x": 64.46101,
        "z": -23.555148
      },
      {
        "x": 72.023491,
        "z": -37.254363
      },
      {
        "x": 76.7,
        "z": -57.2
      },
      {
        "x": 90.35,
        "z": -53.95
      },
      {
        "x": 91.0,
        "z": -53.3
      },
      {
        "x": 89.863189,
        "z": -49.975062
      },
      {
        "x": 103.049053,
        "z": -50.953577
      },
      {
        "x": 122.440029,
        "z": -44.10397
      },
      {
        "x": 132.376991,
        "z": -42.565502
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "east-dorm-access",
    "width": 1.3,
    "kind": "road",
    "points": [
      {
        "x": 72.023491,
        "z": -37.254363
      },
      {
        "x": 79.779881,
        "z": -21.353488
      },
      {
        "x": 102.05,
        "z": -12.35
      },
      {
        "x": 103.242963,
        "z": -10.834448
      },
      {
        "x": 116.622736,
        "z": -28.447724
      },
      {
        "x": 122.440029,
        "z": -44.10397
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "medical-entrance",
    "width": 2.8,
    "kind": "road",
    "points": [
      {
        "x": -16.205451,
        "z": 95.089839
      },
      {
        "x": 5.2,
        "z": 93.6
      },
      {
        "x": 11.135826,
        "z": 92.154293
      },
      {
        "x": 32.659809,
        "z": 89.218747
      },
      {
        "x": 52.438605,
        "z": 79.678222
      },
      {
        "x": 56.51071,
        "z": 53.013679
      },
      {
        "x": 54.959432,
        "z": 37.357433
      },
      {
        "x": 59.15,
        "z": 38.35
      },
      {
        "x": 73.45,
        "z": 27.3
      },
      {
        "x": 74.932137,
        "z": 19.744157
      },
      {
        "x": 76.05,
        "z": 14.95
      },
      {
        "x": 77.452964,
        "z": -0.560037
      },
      {
        "x": 71.5,
        "z": -7.15
      },
      {
        "x": 51.35,
        "z": -15.6
      },
      {
        "x": 42.25,
        "z": -17.55
      },
      {
        "x": 41.6,
        "z": -14.95
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "medical-court",
    "width": 1.8,
    "kind": "road",
    "points": [
      {
        "x": -19.695826,
        "z": 76.253419
      },
      {
        "x": -14.95,
        "z": 68.25
      },
      {
        "x": -12.35,
        "z": 68.25
      },
      {
        "x": -3.213497,
        "z": 69.159182
      },
      {
        "x": 22.770411,
        "z": 65.734379
      },
      {
        "x": 49.4,
        "z": 63.05
      },
      {
        "x": 50.887327,
        "z": 59.374029
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "medical-north",
    "width": 1.5,
    "kind": "road",
    "points": [
      {
        "x": 6.481991,
        "z": 29.52931
      },
      {
        "x": 24.515599,
        "z": 21.456559
      },
      {
        "x": 55.25,
        "z": 20.15
      },
      {
        "x": 59.15,
        "z": 24.05
      },
      {
        "x": 72.15,
        "z": 27.3
      },
      {
        "x": 73.45,
        "z": 24.7
      },
      {
        "x": 74.932137,
        "z": 19.744157
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "historic-east-walk",
    "width": 0.7,
    "kind": "walk",
    "points": [
      {
        "x": -8.415618,
        "z": -31.457962
      },
      {
        "x": -3.25,
        "z": -43.55
      },
      {
        "x": 7.8,
        "z": -40.95
      },
      {
        "x": 9.1,
        "z": -37.7
      },
      {
        "x": 9.1,
        "z": -35.75
      },
      {
        "x": 7.8,
        "z": -41.6
      },
      {
        "x": 5.124623,
        "z": -50.46432
      },
      {
        "x": 3.9,
        "z": -57.85
      },
      {
        "x": 5.85,
        "z": -65.0
      },
      {
        "x": 8.45,
        "z": -69.55
      },
      {
        "x": 8.421089,
        "z": -70.768513
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "historic-west-walk",
    "width": 0.7,
    "kind": "walk",
    "points": [
      {
        "x": -8.415618,
        "z": -31.457962
      },
      {
        "x": -18.144548,
        "z": -33.095672
      },
      {
        "x": -20.15,
        "z": -42.9
      },
      {
        "x": -18.85,
        "z": -47.45
      },
      {
        "x": -16.399361,
        "z": -50.46432
      },
      {
        "x": -6.5,
        "z": -61.75
      },
      {
        "x": -5.2,
        "z": -68.25
      },
      {
        "x": -8.64297,
        "z": -70.768513
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  },
  {
    "id": "dormitory-forecourt",
    "width": 1.5,
    "kind": "road",
    "points": [
      {
        "x": -6.122143,
        "z": -215.588786
      },
      {
        "x": 11.717555,
        "z": -219.01359
      },
      {
        "x": 13.65,
        "z": -234.0
      },
      {
        "x": 14.95,
        "z": -237.25
      },
      {
        "x": 26.066877,
        "z": -242.987216
      },
      {
        "x": 27.424246,
        "z": -253.506256
      },
      {
        "x": 22.1,
        "z": -258.7
      },
      {
        "x": 10.4,
        "z": -261.95
      },
      {
        "x": 9.002818,
        "z": -260.600492
      }
    ],
    "estimated": true,
    "geometrySource": "official diagram control points; offline conservative routing around estimated building/sports envelopes, not surveyed roads"
  }
];
// Outline follows the diagram's irregular core and thin northern dormitory arm.
export const CAMPUS_BOUNDARY = [
  [37.56030,126.93502],[37.56032,126.9380],[37.56030,126.94015],
  [37.56080,126.94206],[37.56317,126.94311],[37.56425,126.94437],
  [37.56513,126.94612],[37.56660,126.94625],[37.56767,126.94338],
  [37.56812,126.94177],[37.57060,126.94138],[37.57310,126.94085],
  [37.57515,126.94062],[37.57516,126.93855],[37.5740,126.93805],
  [37.57235,126.9380],[37.57019,126.93802],[37.56872,126.93734],
  [37.56757,126.93654],[37.56636,126.93442],[37.56474,126.93352],
  [37.56328,126.93148],[37.56208,126.93182],[37.56117,126.93292],
].map(p => geo(...p));
export const FORESTS = [
  // Cheongsongdae / east hillside; the north connector winds through woodland.
  [[37.56465,126.9400],[37.56444,126.9419],[37.5650,126.94265],[37.5675,126.9431],[37.5680,126.9415],[37.5709,126.9411],[37.5725,126.9406],[37.5723,126.93805],[37.5696,126.9381],[37.5685,126.9378],[37.5684,126.9394],[37.5664,126.9400]],
  [[37.5650,126.9339],[37.5662,126.9345],[37.5675,126.9366],[37.5685,126.9374],[37.5681,126.9380],[37.5669,126.9371],[37.5658,126.9365]],
  [[37.5727,126.9381],[37.5738,126.9381],[37.5750,126.9386],[37.57505,126.9405],[37.5732,126.9407],[37.5727,126.9404]],
].map(poly => poly.map(p => geo(...p)));

export function pointInPolygon(x,z,polygon) {
  let inside = false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
export function segmentDistance(x,z,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den)):0;
  return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
}
