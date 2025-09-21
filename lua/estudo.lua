


--[[print("tamanho da base")
local base=io.read("*n")

print("altura")
local altura=io.read("*n")

local area=base*altura

print("a area do quadrado e: "..area)]]

print("vamos calcular bitola de cabos /n qual é o diametro do cabo?")
local diam =io.read("*n")
--recbe o diametro

local raio = diam/2 
--acha o raio do diametro

local area = raio^2*3.14
--calcula a area do circulo sem a biblioteca math
print("a bitola do cabo é "..area.."cm²")

local area2 = raio^2 * math.pi
print("a bitola usando math é " ..area2)
