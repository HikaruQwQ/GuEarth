export interface SampleDataset {
  id: string
  name: string
  description: string
  kml: string
}

const kmlDocument = (name: string, folders: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${name}</name>
${folders.join('\n')}
</Document>
</kml>`

const folder = (name: string, placemarks: string[]): string => `<Folder><name>${name}</name>${placemarks.join('')}</Folder>`

const linePlacemark = (name: string, color: string, width: number, points: Array<[number, number]>): string =>
  `<Placemark><name>${name}</name><Style><LineStyle><color>ff${color.slice(5, 7)}${color.slice(3, 5)}${color.slice(1, 3)}</color><width>${width}</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>${points.map(([lon, lat]) => `${lon},${lat},0`).join(' ')}</coordinates></LineString></Placemark>`

const pointPlacemark = (name: string, color: string, lon: number, lat: number): string =>
  `<Placemark><name>${name}</name><Style><IconStyle><color>ff${color.slice(5, 7)}${color.slice(3, 5)}${color.slice(1, 3)}</color><scale>1.2</scale></IconStyle></Style><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`

const chinaBoundaryLines = kmlDocument('中国主要地理分界线', [
  folder('地理分界线', [
    linePlacemark('秦岭—淮河线', '#fa8c16', 4, [[104, 33.5], [106.5, 33.8], [108, 34], [110, 33.2], [112.5, 33], [115, 33.4], [117.5, 33.8], [120.3, 34.2]]),
    linePlacemark('400mm 年等降水量线', '#1677ff', 4, [[124, 49.5], [122, 46], [117, 43], [114, 40.5], [110, 38.5], [106, 37], [103, 36], [99, 33.5], [95, 31], [91, 29.8], [95.5, 28.3]]),
    linePlacemark('黑河—腾冲线（人口分界线）', '#722ed1', 4, [[127.53, 50.25], [124, 46], [120, 42], [116, 38.5], [112, 35], [108, 32], [104, 28.5], [100, 26.5], [98.5, 25.02]]),
    linePlacemark('地势第一、二级阶梯界线', '#13c2c2', 4, [[75, 36.5], [81, 36], [87, 36.5], [93, 38], [99, 36.5], [101, 32], [102, 30], [98.8, 27.5], [97.5, 25.5]]),
    linePlacemark('地势第二、三级阶梯界线', '#52c41a', 4, [[122, 53], [121, 47], [117.5, 42.5], [114, 36], [112, 33], [110.5, 31.5], [110, 28], [109.8, 26.5]])
  ])
])

const silkRoad = kmlDocument('丝绸之路（长安—罗马）', [
  folder('丝绸之路', [
    linePlacemark('丝绸之路主线', '#d4380d', 4, [[108.9, 34.3], [106.2, 35.5], [102.6, 37.9], [100.4, 38.9], [94.7, 40.1], [91, 39.5], [88.2, 39], [83, 40.5], [80, 41], [76, 39.5], [66.97, 39.65], [61.83, 37.6], [54.3, 36.7], [48.5, 34.5], [44.42, 33.31], [40, 34], [36.3, 33.5], [34.5, 32], [32, 32.5], [28.98, 41.01], [24, 42], [18.5, 42.5], [16.5, 42], [13.5, 42], [12.5, 41.9]]),
    pointPlacemark('长安（西安）', '#d4380d', 108.9, 34.3),
    pointPlacemark('敦煌', '#d4380d', 94.7, 40.1),
    pointPlacemark('喀什', '#d4380d', 76.0, 39.5),
    pointPlacemark('撒马尔罕', '#d4380d', 66.97, 39.65),
    pointPlacemark('巴格达', '#d4380d', 44.42, 33.31),
    pointPlacemark('君士坦丁堡（伊斯坦布尔）', '#d4380d', 28.98, 41.01),
    pointPlacemark('罗马', '#d4380d', 12.5, 41.9)
  ])
])

const ancientCivilizations = kmlDocument('四大文明古国', [
  folder('文明发源地', [
    pointPlacemark('古埃及 · 尼罗河流域', '#faad14', 31.13, 29.98),
    pointPlacemark('古巴比伦 · 两河流域', '#fa541c', 44.42, 32.54),
    pointPlacemark('古印度 · 印度河流域', '#13c2c2', 68.14, 25.43),
    pointPlacemark('古中国 · 黄河流域', '#eb2f96', 112.45, 34.62)
  ])
])

export const SAMPLE_DATASETS: SampleDataset[] = [
  { id: 'china-boundaries', name: '中国主要地理分界线', description: '秦岭—淮河、400mm 等降水量线、黑河—腾冲线与地势阶梯界线', kml: chinaBoundaryLines },
  { id: 'silk-road', name: '丝绸之路（长安—罗马）', description: '沿线主要城市节点与主线走向', kml: silkRoad },
  { id: 'ancient-civilizations', name: '四大文明古国', description: '大河文明发源地点位', kml: ancientCivilizations }
]
