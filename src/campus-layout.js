// Official geographic marker snapshot; runtime requests are intentionally absent.
// Dimensions, floor counts and rotations are diagram-based estimates, not surveyed geometry.
// Overpass footprint attempts returned HTTP 406 or timed out; see reference/official-map/api-research.
export const WORLD_UNITS_PER_METER = .22;
export const GEO_ORIGIN = Object.freeze({ latitude: 37.56433710667622, longitude: 126.93893572124549 });
export const CAMPUS_ORIGIN = GEO_ORIGIN;
export function projectGeo(latitude, longitude) {
  if (![latitude, longitude].every(Number.isFinite)) throw new TypeError('Finite numeric latitude/longitude required');
  const radians = Math.PI / 180, radius = 6371000;
  return {
    x: (longitude - GEO_ORIGIN.longitude) * radians * radius * Math.cos(GEO_ORIGIN.latitude * radians) * WORLD_UNITS_PER_METER,
    z: -(latitude - GEO_ORIGIN.latitude) * radians * radius * WORLD_UNITS_PER_METER,
  };
}
function freezeEntries(entries) { return Object.freeze(entries.map(entry => Object.freeze({ ...entry, source: Object.freeze(entry.source) }))); }
export const LAYOUT = freezeEntries([
  {
    "id": "library",
    "name": "중앙도서관",
    "code": "301",
    "latitude": 37.56378648382193,
    "longitude": 126.93700352048988,
    "x": -37.467259,
    "z": 13.469823,
    "width": 11.44,
    "depth": 13.64,
    "height": 5.06,
    "rotation": -0.245,
    "heightMeters": 23,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1774829590290100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=301&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "engHall",
    "name": "제1공학관",
    "code": "121",
    "latitude": 37.561898691316706,
    "longitude": 126.93662028750198,
    "x": -44.898521,
    "z": 59.650672,
    "width": 8.36,
    "depth": 11.44,
    "height": 4.84,
    "rotation": -0.245,
    "heightMeters": 22,
    "floors": 5,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741157906681100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=121&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height; main volume5, north/south wings6",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "engPark",
    "name": "공학원",
    "code": "102",
    "latitude": 37.56096554418951,
    "longitude": 126.93548360201619,
    "x": -66.939962,
    "z": 82.478142,
    "width": 17.6,
    "depth": 12.54,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741156776954100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=102&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "science",
    "name": "과학관",
    "code": "322",
    "latitude": 37.56420425791077,
    "longitude": 126.93481300824948,
    "x": -79.94343,
    "z": 3.249864,
    "width": 14.08,
    "depth": 11.44,
    "height": 6.82,
    "rotation": -0.245,
    "heightMeters": 31,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741159206395100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=322&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "eng3",
    "name": "제3공학관",
    "code": "123",
    "latitude": 37.561825812598066,
    "longitude": 126.9351489703921,
    "x": -73.428796,
    "z": 61.433495,
    "width": 15.18,
    "depth": 6.16,
    "height": 5.06,
    "rotation": -0.245,
    "heightMeters": 23,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1759389024700100.png",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=123&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "samsung",
    "name": "연세·삼성 학술정보관",
    "code": "302",
    "latitude": 37.56393914810012,
    "longitude": 126.93606394659616,
    "x": -55.686514,
    "z": 9.735214,
    "width": 13.2,
    "depth": 15.84,
    "height": 5.72,
    "rotation": -0.245,
    "heightMeters": 26,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158949097100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=302&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "union",
    "name": "학생회관",
    "code": "207",
    "latitude": 37.563516916745286,
    "longitude": 126.93839027043644,
    "x": -10.576824,
    "z": 20.064211,
    "width": 8.14,
    "depth": 17.6,
    "height": 4.4,
    "rotation": -0.245,
    "heightMeters": 20,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741222050149100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=207&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "daewoo",
    "name": "대우관 본관",
    "code": "513",
    "latitude": 37.56836929325817,
    "longitude": 126.93938237141163,
    "x": 8.660983,
    "z": -98.638912,
    "width": 17.16,
    "depth": 7.7,
    "height": 5.06,
    "rotation": -0.245,
    "heightMeters": 23,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741222423828100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=513&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "yeonhui",
    "name": "연희관",
    "code": "511",
    "latitude": 37.56731720793296,
    "longitude": 126.93904647987706,
    "x": 2.147718,
    "z": -72.901871,
    "width": 11.44,
    "depth": 5.28,
    "height": 3.74,
    "rotation": -0.245,
    "heightMeters": 17,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741160955324100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=511&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "dining",
    "name": "한경관",
    "code": "522",
    "latitude": 37.566012138808084,
    "longitude": 126.93736951156333,
    "x": -30.370335,
    "z": -40.976117,
    "width": 9.46,
    "depth": 5.72,
    "height": 2.64,
    "rotation": -0.245,
    "heightMeters": 12,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741161346434100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=522&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "pinson",
    "name": "핀슨관(윤동주기념관)",
    "code": "521",
    "latitude": 37.565469215364395,
    "longitude": 126.93723131019472,
    "x": -33.050194,
    "z": -27.694643,
    "width": 4.4,
    "depth": 5.94,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 3,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741161280415100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=521&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "underwood",
    "name": "언더우드관(본관)",
    "code": "501",
    "latitude": 37.56645434373733,
    "longitude": 126.93873591048767,
    "x": -3.874526,
    "z": -51.793724,
    "width": 12.32,
    "depth": 4.84,
    "height": 3.74,
    "rotation": -0.245,
    "heightMeters": 17,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741160433430100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=501&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "appenzeller",
    "name": "아펜젤러관",
    "code": "503",
    "latitude": 37.56593642075648,
    "longitude": 126.9390249671319,
    "x": 1.730565,
    "z": -39.123835,
    "width": 10.12,
    "depth": 4.18,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 3,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741160691144100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=503&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "stimson",
    "name": "스팀슨관",
    "code": "502",
    "latitude": 37.566125223862784,
    "longitude": 126.93824380572632,
    "x": -13.416917,
    "z": -43.742503,
    "width": 10.12,
    "depth": 4.4,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741160592758100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=502&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "theology",
    "name": "원두우신학관",
    "code": "523",
    "latitude": 37.5659599708557,
    "longitude": 126.9366932495096,
    "x": -43.483716,
    "z": -39.699938,
    "width": 6.16,
    "depth": 14.96,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741161427404100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=523&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "education",
    "name": "교육과학관",
    "code": "526",
    "latitude": 37.56678028241785,
    "longitude": 126.93745376130248,
    "x": -28.73665,
    "z": -59.767124,
    "width": 12.1,
    "depth": 9.46,
    "height": 5.06,
    "rotation": -0.245,
    "heightMeters": 23,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741222751931100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=526&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "eng2",
    "name": "제2공학관",
    "code": "122",
    "latitude": 37.56242502156527,
    "longitude": 126.93523333892183,
    "x": -71.792807,
    "z": 46.775116,
    "width": 17.38,
    "depth": 6.38,
    "height": 4.84,
    "rotation": -0.245,
    "heightMeters": 22,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741157959955100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=122&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "baekyang",
    "name": "백양관",
    "code": "310",
    "latitude": 37.56478236079649,
    "longitude": 126.93752334421185,
    "x": -27.387369,
    "z": -10.8922,
    "width": 9.9,
    "depth": 14.3,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741159174188100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=310&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "samsungHall",
    "name": "삼성관",
    "code": "325",
    "latitude": 37.564983339975015,
    "longitude": 126.93430864383379,
    "x": -89.723548,
    "z": -15.80873,
    "width": 6.38,
    "depth": 14.52,
    "height": 4.4,
    "rotation": -0.245,
    "heightMeters": 20,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741222227528100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=325&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "centennial",
    "name": "백주년기념관",
    "code": "201",
    "latitude": 37.56220128195952,
    "longitude": 126.93804614398852,
    "x": -17.249771,
    "z": 52.248432,
    "width": 12.32,
    "depth": 13.42,
    "height": 4.62,
    "rotation": -0.245,
    "heightMeters": 21,
    "floors": 5,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741221984405100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=201&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "auditorium",
    "name": "대강당",
    "code": "211",
    "latitude": 37.5645442462964,
    "longitude": 126.93876294183697,
    "x": -3.350361,
    "z": -5.067232,
    "width": 9.68,
    "depth": 7.48,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 3,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158750216100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=211&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; conservative depth near adjacent auditorium/business markers with unspecified centroid",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "nonjidang",
    "name": "논지당",
    "code": "505",
    "latitude": 37.566324041147034,
    "longitude": 126.93939817750609,
    "x": 8.967478,
    "z": -48.606147,
    "width": 3.08,
    "depth": 2.2,
    "height": 1.32,
    "rotation": -0.245,
    "heightMeters": 6,
    "floors": 1,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741160794145100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=505&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "gym",
    "name": "체육관",
    "code": "304",
    "latitude": 37.56316859996093,
    "longitude": 126.93570241304487,
    "x": -62.697002,
    "z": 28.585044,
    "width": 13.42,
    "depth": 9.46,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741161600360100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=304&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "music",
    "name": "음악관",
    "code": "213",
    "latitude": 37.56397716023669,
    "longitude": 126.93981603810019,
    "x": 17.070203,
    "z": 8.805328,
    "width": 18.7,
    "depth": 6.82,
    "height": 4.84,
    "rotation": -0.245,
    "heightMeters": 22,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158871527100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=213&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "luce-wing",
    "name": "루스채플",
    "code": "208",
    "latitude": 37.5633595334989,
    "longitude": 126.93895066732722,
    "x": 0.289819,
    "z": 23.914259,
    "width": 8.8,
    "depth": 5.5,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158700105100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=208&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "law",
    "name": "광복관",
    "code": "308",
    "latitude": 37.56470085228176,
    "longitude": 126.93673676027974,
    "x": -42.64,
    "z": -8.898267,
    "width": 9.68,
    "depth": 11.22,
    "height": 5.72,
    "rotation": -0.245,
    "heightMeters": 26,
    "floors": 5,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741222155596100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=308&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "eng4",
    "name": "제4공학관",
    "code": "124",
    "latitude": 37.56197950645202,
    "longitude": 126.93611089454741,
    "x": -54.776147,
    "z": 57.6737,
    "width": 9.24,
    "depth": 9.9,
    "height": 5.28,
    "rotation": -0.245,
    "heightMeters": 24,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158038101100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=124&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "business",
    "name": "경영관",
    "code": "212",
    "latitude": 37.564900262651456,
    "longitude": 126.93900034446061,
    "x": 1.253107,
    "z": -13.776419,
    "width": 10.56,
    "depth": 8.8,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 6,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741158820494100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=212&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; conservative depth near adjacent auditorium/business markers with unspecified centroid",
      "height": "roof height remains estimated; official floor count does not certify exterior height",
      "floorCount": "official building history/2026 handbook cross-check; separate from estimated roof height",
      "floorURLs": [
        "https://www.yonsei.ac.kr/sc/349/subview.do",
        "https://www.yonsei.ac.kr/bbs/sc/61/1013217/download.do"
      ]
    }
  },
  {
    "id": "amphitheater",
    "name": "노천극장",
    "code": "401",
    "latitude": 37.56542538801525,
    "longitude": 126.93957434758238,
    "x": 12.383588,
    "z": -26.6225,
    "width": 15.84,
    "depth": 14.52,
    "height": 1.98,
    "rotation": -0.245,
    "heightMeters": 9,
    "floors": 1,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/atchmnfl/campusMap//thumbnail/temp_1741159928890100.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=401&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  }
]);

export const CONTEXT_BUILDINGS = freezeEntries([
  {
    "id": "context-001",
    "name": "연세암병원",
    "code": "001",
    "latitude": 37.561048342149,
    "longitude": 126.93868940546754,
    "x": -4.776303,
    "z": 80.452665,
    "width": 22.0,
    "depth": 16.5,
    "height": 13.64,
    "rotation": -0.245,
    "heightMeters": 62,
    "floors": 17,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=001&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-002",
    "name": "의과대학",
    "code": "002",
    "latitude": 37.561053337004545,
    "longitude": 126.93964012867501,
    "x": 13.659148,
    "z": 80.330476,
    "width": 12.609,
    "depth": 5.359,
    "height": 7.04,
    "rotation": -0.245,
    "heightMeters": 32,
    "floors": 8,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=002&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; envelope reduced near neighboring markers to avoid uncertain overlaps",
      "height": "estimated floor count and roof height; not official measurements",
      "envelopeScale": 0.716
    }
  },
  {
    "id": "context-004",
    "name": "의료원 종합관/장례식장",
    "code": "004",
    "latitude": 37.56136929011615,
    "longitude": 126.94083394704883,
    "x": 36.808451,
    "z": 72.601352,
    "width": 11.88,
    "depth": 8.36,
    "height": 6.38,
    "rotation": -0.245,
    "heightMeters": 29,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=004&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-005",
    "name": "세브란스병원 본관",
    "code": "005",
    "latitude": 37.562263593990764,
    "longitude": 126.9409634010327,
    "x": 39.31869,
    "z": 50.7241,
    "width": 22.0,
    "depth": 16.5,
    "height": 13.64,
    "rotation": -0.245,
    "heightMeters": 62,
    "floors": 17,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=005&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-006",
    "name": "재활병원",
    "code": "006",
    "latitude": 37.56313954259312,
    "longitude": 126.94042508117737,
    "x": 28.880143,
    "z": 29.295871,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=006&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-008",
    "name": "심장혈관병원",
    "code": "008",
    "latitude": 37.562742603367234,
    "longitude": 126.93944069317384,
    "x": 9.791899,
    "z": 39.006149,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=008&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-011",
    "name": "치과대학병원",
    "code": "011",
    "latitude": 37.56309963342623,
    "longitude": 126.94169844328584,
    "x": 53.571877,
    "z": 30.272164,
    "width": 11.88,
    "depth": 8.36,
    "height": 6.38,
    "rotation": -0.245,
    "heightMeters": 29,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=011&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-012",
    "name": "치과대학",
    "code": "012",
    "latitude": 37.563523437700646,
    "longitude": 126.94238288565742,
    "x": 66.843883,
    "z": 19.90469,
    "width": 11.88,
    "depth": 8.36,
    "height": 6.38,
    "rotation": -0.245,
    "heightMeters": 29,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=012&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-013",
    "name": "에비슨의생명연구센터",
    "code": "013",
    "latitude": 37.56400318486408,
    "longitude": 126.94231460440801,
    "x": 65.519843,
    "z": 8.168691,
    "width": 11.88,
    "depth": 8.36,
    "height": 6.38,
    "rotation": -0.245,
    "heightMeters": 29,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=013&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-014",
    "name": "간호대학",
    "code": "014",
    "latitude": 37.5636808637193,
    "longitude": 126.94187625797039,
    "x": 57.019878,
    "z": 16.053595,
    "width": 8.511,
    "depth": 5.989,
    "height": 6.38,
    "rotation": -0.245,
    "heightMeters": 29,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=014&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; envelope reduced near neighboring markers to avoid uncertain overlaps",
      "height": "estimated floor count and roof height; not official measurements",
      "envelopeScale": 0.716
    }
  },
  {
    "id": "context-114",
    "name": "산학협동연구관",
    "code": "114",
    "latitude": 37.56283331397935,
    "longitude": 126.93227321050486,
    "x": -129.192587,
    "z": 36.787106,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build23.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=114&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-115",
    "name": "GS칼텍스산학협력관",
    "code": "115",
    "latitude": 37.56296893123465,
    "longitude": 126.93309367692524,
    "x": -113.282942,
    "z": 33.469517,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build52.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=115&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-117",
    "name": "첨단과학기술연구관",
    "code": "117",
    "latitude": 37.56338830258988,
    "longitude": 126.9338176881258,
    "x": -99.243658,
    "z": 23.210484,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build45.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=117&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-324",
    "name": "IBS관",
    "code": "324",
    "latitude": 37.56298322375952,
    "longitude": 126.9344801771833,
    "x": -86.397349,
    "z": 33.119881,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build53.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=324&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-323",
    "name": "과학원",
    "code": "323",
    "latitude": 37.563541888271416,
    "longitude": 126.93456457710975,
    "x": -84.760752,
    "z": 19.453335,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build5.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=323&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-305",
    "name": "스포츠과학관",
    "code": "305",
    "latitude": 37.56283964386842,
    "longitude": 126.93553291897335,
    "x": -65.983658,
    "z": 36.632259,
    "width": 6.6,
    "depth": 5.72,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 3,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build29.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=305&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-306",
    "name": "체육교육관",
    "code": "306",
    "latitude": 37.56327644409217,
    "longitude": 126.93519864629836,
    "x": -72.465531,
    "z": 25.946866,
    "width": 6.072,
    "depth": 5.262,
    "height": 3.3,
    "rotation": -0.245,
    "heightMeters": 15,
    "floors": 3,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build47.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=306&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; envelope reduced near neighboring markers to avoid uncertain overlaps",
      "height": "estimated floor count and roof height; not official measurements",
      "envelopeScale": 0.92
    }
  },
  {
    "id": "context-326",
    "name": "언더우드가 기념관",
    "code": "326",
    "latitude": 37.566053666774366,
    "longitude": 126.93502079705934,
    "x": -75.914202,
    "z": -41.99201,
    "width": 5.06,
    "depth": 4.4,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build32.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=326&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-506",
    "name": "성암관",
    "code": "506",
    "latitude": 37.56678131666254,
    "longitude": 126.93943742372464,
    "x": 9.728501,
    "z": -59.792425,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build27.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=506&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-507",
    "name": "유억겸기념관",
    "code": "507",
    "latitude": 37.5670352942995,
    "longitude": 126.93836756436345,
    "x": -11.017117,
    "z": -66.00545,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build39.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=507&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-512",
    "name": "빌링슬리관",
    "code": "512",
    "latitude": 37.567884510412064,
    "longitude": 126.9384206309385,
    "x": -9.988104,
    "z": -86.779726,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build22.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=512&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-514",
    "name": "대우관 별관",
    "code": "514",
    "latitude": 37.567808665440126,
    "longitude": 126.93985540250986,
    "x": 17.833517,
    "z": -84.924339,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=514&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-524",
    "name": "외솔관",
    "code": "524",
    "latitude": 37.56640610442741,
    "longitude": 126.9369560385174,
    "x": -38.387981,
    "z": -50.613652,
    "width": 7.7,
    "depth": 5.72,
    "height": 4.4,
    "rotation": -0.245,
    "heightMeters": 20,
    "floors": 5,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build36.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=524&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-525",
    "name": "외솔관2",
    "code": "525",
    "latitude": 37.56660434456544,
    "longitude": 126.93699548802252,
    "x": -37.623016,
    "z": -55.463177,
    "width": 3.636,
    "depth": 2.701,
    "height": 4.4,
    "rotation": -0.245,
    "heightMeters": 20,
    "floors": 5,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=525&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; envelope reduced near neighboring markers to avoid uncertain overlaps",
      "height": "estimated floor count and roof height; not official measurements",
      "envelopeScale": 0.472
    }
  },
  {
    "id": "context-527",
    "name": "위당관",
    "code": "527",
    "latitude": 37.56724451317453,
    "longitude": 126.93786652097715,
    "x": -20.732837,
    "z": -71.123548,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build38.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=527&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-414",
    "name": "상남경영관",
    "code": "414",
    "latitude": 37.56500121413375,
    "longitude": 126.9426760357869,
    "x": 72.52835,
    "z": -16.245984,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build25.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=414&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-415",
    "name": "어린이가족연구원 연구동",
    "code": "415",
    "latitude": 37.56480460135312,
    "longitude": 126.94136038177793,
    "x": 47.016535,
    "z": -11.436268,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=415&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-416",
    "name": "어린이가족연구원 본관",
    "code": "416",
    "latitude": 37.56451861099361,
    "longitude": 126.94151340848664,
    "x": 49.983872,
    "z": -4.440119,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=416&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-417",
    "name": "알렌관",
    "code": "417",
    "latitude": 37.56448974749395,
    "longitude": 126.94236516339029,
    "x": 66.500231,
    "z": -3.734035,
    "width": 5.06,
    "depth": 4.4,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 2,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build31.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=417&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-605",
    "name": "국제학사",
    "code": "605",
    "latitude": 37.566078426543875,
    "longitude": 126.94376182882534,
    "x": 93.582937,
    "z": -42.597706,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build9.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=605&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-606",
    "name": "새천년관",
    "code": "606",
    "latitude": 37.566384491363785,
    "longitude": 126.943189989789,
    "x": 82.49442,
    "z": -50.084934,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build26.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=606&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-608",
    "name": "영빈관",
    "code": "608",
    "latitude": 37.5670646228569,
    "longitude": 126.942940453246,
    "x": 77.655663,
    "z": -66.722912,
    "width": 5.06,
    "depth": 4.4,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 2,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=608&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-609",
    "name": "총장공관",
    "code": "609",
    "latitude": 37.56700136379505,
    "longitude": 126.94254999316193,
    "x": 70.084261,
    "z": -65.175412,
    "width": 5.06,
    "depth": 4.4,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 2,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=609&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-621",
    "name": "언어연구교육원(한국어학당)",
    "code": "621",
    "latitude": 37.56538003604678,
    "longitude": 126.94351333943922,
    "x": 88.764485,
    "z": -25.51306,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build33.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=621&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-622",
    "name": "이윤재관",
    "code": "622",
    "latitude": 37.564706665998884,
    "longitude": 126.94377417878763,
    "x": 93.822415,
    "z": -9.040487,
    "width": 11.22,
    "depth": 8.14,
    "height": 5.94,
    "rotation": -0.245,
    "heightMeters": 27,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build41.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=622&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-701",
    "name": "무악 1학사",
    "code": "701",
    "latitude": 37.57483186009645,
    "longitude": 126.93973372178195,
    "x": 15.474009,
    "z": -256.731934,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build15.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=701&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-702",
    "name": "무악 2학사",
    "code": "702",
    "latitude": 37.57466488877785,
    "longitude": 126.93917350436656,
    "x": 4.610847,
    "z": -252.647334,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=702&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-703",
    "name": "무악 3학사",
    "code": "703",
    "latitude": 37.57382287340126,
    "longitude": 126.93998357740466,
    "x": 20.318954,
    "z": -232.04921,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=703&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-704",
    "name": "무악 4학사",
    "code": "704",
    "latitude": 37.57359715510048,
    "longitude": 126.93906683204243,
    "x": 2.542366,
    "z": -226.527489,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=704&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-706",
    "name": "운동선수기숙사",
    "code": "706",
    "latitude": 37.572193698076035,
    "longitude": 126.93876233905742,
    "x": -3.36205,
    "z": -192.194883,
    "width": 8.58,
    "depth": 5.72,
    "height": 3.96,
    "rotation": -0.245,
    "heightMeters": 18,
    "floors": 4,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=706&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-709",
    "name": "아식설계공동연구소",
    "code": "709",
    "latitude": 37.57235428982926,
    "longitude": 126.94005833521712,
    "x": 21.768581,
    "z": -196.12342,
    "width": 5.06,
    "depth": 4.4,
    "height": 2.2,
    "rotation": -0.245,
    "heightMeters": 10,
    "floors": 2,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=709&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-713",
    "name": "우정원",
    "code": "713",
    "latitude": 37.5708448350177,
    "longitude": 126.93949356176851,
    "x": 10.817072,
    "z": -159.197803,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=713&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-602",
    "name": "법현학사",
    "code": "602",
    "latitude": 37.56574591347106,
    "longitude": 126.94558725019475,
    "x": 128.979639,
    "z": -34.463477,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build20.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=602&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-603-A",
    "name": "제중학사",
    "code": "603-A",
    "latitude": 37.56563508221479,
    "longitude": 126.9445997589118,
    "x": 109.831219,
    "z": -31.752225,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build42.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=603-A&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-603-B",
    "name": "연세에비슨하우스",
    "code": "603-B",
    "latitude": 37.565328553108074,
    "longitude": 126.9441953377712,
    "x": 101.989099,
    "z": -24.253639,
    "width": 10.56,
    "depth": 4.18,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": null,
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=603-B&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints",
      "height": "estimated floor count and roof height; not official measurements"
    }
  },
  {
    "id": "context-604",
    "name": "SK국제학사",
    "code": "604",
    "latitude": 37.56573395832521,
    "longitude": 126.94410448422587,
    "x": 100.22736,
    "z": -34.17102,
    "width": 8.938,
    "depth": 3.538,
    "height": 5.5,
    "rotation": -0.245,
    "heightMeters": 25,
    "floors": 7,
    "photoURL": "https://www.yonsei.ac.kr/sites/sc/images/sub/img-build54.jpg",
    "source": {
      "position": "official geographic map marker (centroid/entrance unspecified)",
      "url": "https://www.yonsei.ac.kr/campusMap/sc/view.do?srchBuildFilter=604&srchCampsFilter=sc",
      "geometry": "estimated proportions from official 2024 campus diagram; not surveyed footprints; conservative envelope reduced near adjacent marker",
      "height": "estimated floor count and roof height; not official measurements",
      "envelopeScale": 0.846
    }
  }
]);
