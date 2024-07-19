Map.centerObject(roi);

// Terapkan cloud mask
var maskClouds = function(image) {
  var qa = image.select('QA_PIXEL');
  var cloud = qa.bitwiseAnd(1 << 5).and(qa.bitwiseAnd(1 << 7)).or(qa.bitwiseAnd(1 << 3));
  var mask2 = image.mask().reduce(ee.Reducer.min());
  return image.updateMask(cloud.not()).updateMask(mask2);
};

var composite = ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
  .filterMetadata('CLOUD_COVER', 'less_than',60 )
  .map(maskClouds)
  .filterDate('2022-01-01', '2022-12-28')
  .median()
  .clip(roi);
  
print(composite)  

//menampilkan citra tanpa awan
Map.addLayer(composite,{bands: ['B4','B3','B2'], min:0, max: 0.3},  'tanpa awan');


//var bands = ["B2", "B3", "B4", "B5", "B6", "B7"];
//var composite = composite.select(bands);

// IHS Pan-sharpening
var hsv = composite.select(['B4', 'B3', 'B2']).rgbToHsv();
var sharpenedRGB = ee.Image.cat([
  hsv.select('hue'), hsv.select('saturation'), composite.select('B8')
]).hsvToRgb();

// Combine sharpened RGB with B4, B5, B6, B7
var sharpened = sharpenedRGB.addBands(composite.select([ 'B5', 'B6', 'B7']));

Map.addLayer(sharpened, {bands: ['red', 'green', 'blue'], min:0, max: 0.3}, 'IHS Sharpened');

//Export.table.toAsset(awan, 'awanToAsset', 'awan_new');
Export.table.toAsset(Air, 'perairanToAsset', 'air5');
Export.table.toAsset(kopi, 'kopiToAsset', 'kopi5');
Export.table.toAsset(Hutan, 'hutanToAsset', 'hutan5');
Export.table.toAsset(nonkopi, 'nonkopiToAsset', 'nonkopi5');
Export.table.toAsset(Tanah, 'tanahToAsset', 'tanah5');
Export.table.toAsset(Bangunan, 'bangunanToAsset2', 'lahan_terbangun51');

// Merge titik sampel setiap kelas menjadi satu, lakukan ini pada project baru
// Input setiap kelas yang telah ditambahkan ke dalam "Asset" GEE
var aoi = Bangunan.merge(Tanah).merge(Hutan).merge(nonkopi).merge(kopi).merge(Air);
Export.table.toAsset(aoi, 'aoiToAsset', 'aoi4');
