//caculos

function calcularLucro(valorBase, quantmes){
    const valGeleia = 2*valorBase + 50;
    const lucroMes = valGeleia*quantmes;
    const lucroDia = lucroMes/30;
    return{valGeleia,lucroMes,lucroDia};
}

//banco de dados

    const bancoFrutas = {banana: {valorBase: 150, quantmes: 8}, 
                         abacaxi:{valorBase: 300, quantmes: 4} };
//consulta

function consultaBanco(nomeFruta){  
  const registro = bancoFrutas[nomeFruta.toLowerCase()];
  if (!registro){
    console.log('não encontrado');
    return;
  } 
  
  const resultado = calcularLucro(registro.valorBase, registro.quantmes);
  console.log(`${nomeFruta.charAt(0).toUpperCase() + nomeFruta.slice(1)}:`);
console.log(`valor da geleia: ${resultado.valGeleia} ouros`);
console.log(`lucro diario: ${resultado.lucroDia.toFixed(2)} ouros/ dia \n`);
console.log(`lucro mensal: ${resultado.lucroMes} ouros \n ************************`);
} 

consultaBanco("banana");
consultaBanco("abacaxi");