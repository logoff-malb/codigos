const fs = require('fs');

// 1. Carrega o arquivo original
const rawData = fs.readFileSync('Farm1.json');
const mapData = JSON.parse(rawData);

// 2. Cria um novo objeto apenas com o que você PRECISA
const optimizedMap = {
    width: mapData.width,
    height: mapData.height,
    tilewidth: mapData.tilewidth,
    tileheight: mapData.tileheight,
    // Filtra apenas as camadas essenciais (ex: a camada de colisão/regras)
    layers: mapData.layers.map(layer => ({
        name: layer.name,
        data: layer.data, // A matriz de números do mapa
        width: layer.width,
        height: layer.height
    })),
    // Extrai apenas os IDs e propriedades dos tiles (para verificar colisão/regras)
    tilesets: mapData.tilesets.map(ts => ({
        firstgid: ts.firstgid,
        tiles: ts.tiles ? ts.tiles.map(t => ({
            id: t.id,
            properties: t.properties // Mantém apenas as propriedades que você precisa
        })) : []
    }))
};

// 3. Salva o arquivo reduzido
fs.writeFileSync('mapa_otimizado.json', JSON.stringify(optimizedMap));
console.log("Arquivo otimizado gerado com sucesso!");