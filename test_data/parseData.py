# -*- coding: utf-8 -*-
"""
Created on Sat Dec  4 16:17:14 2021

@author: Jurek
"""

import csv

sumEat = 0
sumEsat = 0
sumMeat = 0

sumRaptorMeatCompleteDuration = 0
maxRaptorMeatCompleteDuration = 0
sumRaptorMeatInitDuration = 0
maxRaptorMeatInitDuration = 0
sumRaptorMeatAlgorithmDuration = 0
maxRaptorMeatAlgorithmDuration = 0
sumRaptorMeatGraphDuration = 0
maxRaptorMeatGraphDuration = 0

sumRaptorMeatInitLoopDuration = 0
sumRaptorMeatTraverseRoutesLoopDuration = 0
sumRaptorMeatUpdateLoopDuration = 0

sumCSAMeatCompleteDuration = 0
maxCSAMeatCompleteDuration = 0
sumCSAMeatInitDuration = 0
maxCSAMeatInitDuration = 0
sumCSAMeatAlgorithmDuration = 0
maxCSAMeatAlgorithmDuration = 0
sumCSAMeatGraphDuration = 0
maxCSAMeatGraphDuration = 0

sumCSAEatCompleteDuration = 0
maxCSAEatCompleteDuration = 0
sumCSAEatInitDuration = 0
maxCSAEatInitDuration = 0
sumCSAEatAlgorithmDuration = 0
maxCSAEatAlgorithmDuration = 0
sumCSAEatGraphDuration = 0
maxCSAEatGraphDuration = 0

resultcounter = 0
successfulCsaExpAtCounter = 0
for i in range(0, 20):
    path = 'dm1_alpha1v' + str(i) + '.csv'
    with open(path) as csvdatei:
        csv_reader_object = csv.DictReader(csvdatei, delimiter=',')
        for row in csv_reader_object:
            currentSourceTime = float(row['Source Time'])
            currentMeatDuration = float(row['MEAT']) - currentSourceTime
            currentExpAt = float(row['CSA ExpAT'])
            
            sumEat += float(row['EAT']) - currentSourceTime
            sumEsat += float(row['ESAT']) - currentSourceTime
            sumMeat += currentMeatDuration
            
            sumRaptorMeatCompleteDuration += float(row['Raptor MEAT Complete'])
            if float(row['Raptor MEAT Complete']) > maxRaptorMeatCompleteDuration:
                maxRaptorMeatCompleteDuration = float(row['Raptor MEAT Complete'])
            sumRaptorMeatInitDuration += float(row['Raptor MEAT Init'])
            if float(row['Raptor MEAT Init']) > maxRaptorMeatInitDuration:
                maxRaptorMeatInitDuration = float(row['Raptor MEAT Init'])
            sumRaptorMeatAlgorithmDuration += float(row['Raptor MEAT Algorithm'])
            if float(row['Raptor MEAT Algorithm']) > maxRaptorMeatAlgorithmDuration:
                maxRaptorMeatAlgorithmDuration = float(row['Raptor MEAT Algorithm'])
            sumRaptorMeatGraphDuration += float(row['Raptor MEAT Decision Graph'])
            if float(row['Raptor MEAT Decision Graph']) > maxRaptorMeatGraphDuration:
                maxRaptorMeatGraphDuration = float(row['Raptor MEAT Decision Graph'])
                
            sumRaptorMeatInitLoopDuration += float(row['Raptor MEAT Init Loop'])
            sumRaptorMeatTraverseRoutesLoopDuration += float(row['Raptor MEAT Traverse Routes Loop'])
            sumRaptorMeatUpdateLoopDuration += float(row['Raptor MEAT Update Loop'])
            
            sumCSAMeatCompleteDuration += float(row['CSA MEAT Complete'])
            if float(row['CSA MEAT Complete']) > maxCSAMeatCompleteDuration:
                maxCSAMeatCompleteDuration = float(row['CSA MEAT Complete'])
            sumCSAMeatInitDuration += float(row['CSA MEAT Init'])
            if float(row['CSA MEAT Init']) > maxCSAMeatInitDuration:
                maxCSAMeatInitDuration = float(row['CSA MEAT Init'])
            sumCSAMeatAlgorithmDuration += float(row['CSA MEAT Algorithm'])
            if float(row['CSA MEAT Init']) > maxCSAMeatAlgorithmDuration:
                maxCSAMeatAlgorithmDuration = float(row['CSA MEAT Init'])
            sumCSAMeatGraphDuration += float(row['CSA MEAT Decision Graph'])
            if float(row['CSA MEAT Decision Graph']) > maxCSAMeatGraphDuration:
                maxCSAMeatGraphDuration = float(row['CSA MEAT Decision Graph'])
                
            sumCSAEatCompleteDuration += float(row['CSA ExpAT Complete'])
            if float(row['CSA ExpAT Complete']) > maxCSAEatCompleteDuration:
                maxCSAEatCompleteDuration = float(row['CSA ExpAT Complete'])
            sumCSAEatInitDuration += float(row['CSA ExpAT Init'])
            if float(row['CSA ExpAT Init']) > maxCSAEatInitDuration:
                maxCSAEatInitDuration = float(row['CSA ExpAT Init'])
            sumCSAEatAlgorithmDuration += float(row['CSA ExpAT Algorithm'])
            if float(row['CSA ExpAT Init']) > maxCSAEatAlgorithmDuration:
                maxCSAEatAlgorithmDuration = float(row['CSA ExpAT Init'])
            if currentExpAt != 1.7976931348623157e+308:
                sumCSAEatGraphDuration += float(row['CSA ExpAT Decision Graph'])
                if float(row['CSA ExpAT Decision Graph']) > maxCSAEatGraphDuration:
                    maxCSAEatGraphDuration = float(row['CSA ExpAT Decision Graph'])
                successfulCsaExpAtCounter += 1
                
            resultcounter += 1


averageEat = sumEat/resultcounter
averageEsat = sumEsat/resultcounter
averageMeat = sumMeat/resultcounter

averageRaptorMeatCompleteDuration = sumRaptorMeatCompleteDuration/resultcounter
averageRaptorMeatInitDuration = sumRaptorMeatInitDuration/resultcounter
averageRaptorMeatAlgorithmDuration = sumRaptorMeatAlgorithmDuration/resultcounter
averageRaptorMeatGraphDuration = sumRaptorMeatGraphDuration/resultcounter

averageRaptorMeatInitLoopDuration = sumRaptorMeatInitLoopDuration/resultcounter
averageRaptorMeatTraverseRoutesLoopDuration = sumRaptorMeatTraverseRoutesLoopDuration/resultcounter
averageRaptorMeatUpdateLoopDuration = sumRaptorMeatUpdateLoopDuration/resultcounter

averageCSAMeatCompleteDuration = sumCSAMeatCompleteDuration/resultcounter
averageCSAMeatInitDuration = sumCSAMeatInitDuration/resultcounter
averageCSAMeatAlgorithmDuration = sumCSAMeatAlgorithmDuration/resultcounter
averageCSAMeatGraphDuration = sumCSAMeatGraphDuration/resultcounter

averageCSAEatCompleteDuration = sumCSAEatCompleteDuration/resultcounter
averageCSAEatInitDuration = sumCSAEatInitDuration/resultcounter
averageCSAEatAlgorithmDuration = sumCSAEatAlgorithmDuration/resultcounter
averageCSAEatGraphDuration = sumCSAEatGraphDuration/successfulCsaExpAtCounter

print('average eat:', averageEat)
print('average esat:', averageEsat)
print('average meat:', averageMeat)
print('')
print('average raptor meat complete duration', averageRaptorMeatCompleteDuration)
print('max raptor meat complete duration', maxRaptorMeatCompleteDuration)
print('average raptor meat init duration', averageRaptorMeatInitDuration)
print('max raptor meat init duration', maxRaptorMeatInitDuration)
print('average raptor meat algorithm duration', averageRaptorMeatAlgorithmDuration)
print('max raptor meat algorithm duration', maxRaptorMeatAlgorithmDuration)
print('average raptor meat graph duration', averageRaptorMeatGraphDuration)
print('max raptor meat graph duration', maxRaptorMeatGraphDuration)
print('')
print('average raptor meat init loop duration', averageRaptorMeatInitLoopDuration)
print('average raptor meat init loop duration', averageRaptorMeatTraverseRoutesLoopDuration)
print('average raptor meat init loop duration', averageRaptorMeatUpdateLoopDuration)
print('')
print('average csa meat complete duration', averageCSAMeatCompleteDuration)
print('max csa meat complete duration', maxCSAMeatCompleteDuration)
print('average csa meat init duration', averageCSAMeatInitDuration)
print('max csa meat init duration', maxCSAMeatInitDuration)
print('average csa meat algorithm duration', averageCSAMeatAlgorithmDuration)
print('max csa meat algorithm duration', maxCSAMeatAlgorithmDuration)
print('average csa meat graph duration', averageCSAMeatGraphDuration)
print('max csa meat graph duration', maxCSAMeatGraphDuration)
print('')
print('average csa expat complete duration', averageCSAEatCompleteDuration)
print('max csa expat complete duration', maxCSAEatCompleteDuration)
print('average csa expat init duration', averageCSAEatInitDuration)
print('max csa expat init duration', maxCSAEatInitDuration)
print('average csa expat algorithm duration', averageCSAEatAlgorithmDuration)
print('max csa expat algorithm duration', maxCSAEatAlgorithmDuration)
print('average csa expat graph duration', averageCSAEatGraphDuration)
print('max csa expat graph duration', maxCSAEatGraphDuration)