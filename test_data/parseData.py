# -*- coding: utf-8 -*-
"""
Created on Sat Dec  4 16:17:14 2021

@author: Jurek
"""

import csv
from matplotlib import pyplot as plt

dm1Alpha2RaptorMeatTBRelDurations = []
dm1Alpha2RaptorMeatTBRelNumberOfResults = []
dm1Alpha2RaptorMeatTBRelExpATDiff = []

dm2Alpha2RaptorMeatTBRelDurations = []
dm2Alpha2RaptorMeatTBRelNumberOfResults = []
dm2Alpha2RaptorMeatTBRelExpATDiff = []

for dm in range(1, 3):
    print('')
    print('dm: ', dm)
    
    alpha1Values = []
    alpha1MeatSum = 0
    alpha2Values = []
    alpha2MeatSum = 0
    
    for alpha in range(1, 4):
        print('')
        print('alpha: ', alpha)
        print('')
        
        sumEat = 0
        sumEsat = 0
        sumMeat = 0
        
        sumMeatForExpATResults = 0
        sumCSAKnownDelay = 0
        
        sumRaptorMeatComputedRounds = 0
        maxRaptorMeatComputedRounds = 0
        sumRaptorMeatResultRound = 0
        maxRaptorMeatResultRound = 0
        
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
        
        sumAlpha1AbsDiff = 0
        maxAlpha1AbsDiff = 0
        sumAlpha2AbsDiff = 0
        maxAlpha2AbsDiff = 0
        
        maxAlpha1RelDiff = 0
        maxAlpha2RelDiff = 0
        
        sumExpATMeatAbsDiff = 0
        maxExpATMeatAbsDiff = 0
        maxExpATMeatRelDiff = 0
        
        sumKnownDelayAbsDiff = 0
        maxKnownDelayAbsDiff = 0
        maxKnownDelayRelDiff = 0
        
        sumRaptorMeatStops = 0
        maxRaptorMeatStops = 0
        sumRaptorMeatLegs = 0
        maxRaptorMeatLegs = 0
        sumRaptorMeatEdges = 0
        maxRaptorMeatEdges = 0
        
        sumRaptorMeatTOStops = 0
        maxRaptorMeatTOStops = 0
        sumRaptorMeatTOLegs = 0
        maxRaptorMeatTOLegs = 0
        sumRaptorMeatTOEdges = 0
        maxRaptorMeatTOEdges = 0
        
        sumRaptorMeatTOAbsTimeDiff = 0
        maxRaptorMeatTOAbsTimeDiff = 0
        sumRaptorMeatTOAbsTransfersDiff = 0
        maxRaptorMeatTOAbsTransfersDiff = 0
        
        maxRaptorMeatTORelTimeDiff = 0
        maxRaptorMeatTORelTransfersDiff = 0
        
        sumRaptorTBAbsExpATDiffs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        maxRaptorTBAbsExpATDiffs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        sumRaptorTBAbsDuration = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        maxRaptorTBAbsDuration = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        
        sumRaptorTBRelExpATDiffs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        maxRaptorTBRelExpATDiffs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        sumRaptorTBRelDuration = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        maxRaptorTBRelDuration = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        
        raptorTBResultCounter = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        raptorTBComputedRoundCounter = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        
        resultcounter = 0
        successfulCsaExpAtCounter = 0
        knownDelaySameResultCounter = 0
        
        for i in range(0, 20):
            path = 'dm' + str(dm) + '_alpha' + str(alpha) + 'v' + str(i) + '.csv'
            with open(path) as csvdatei:
                csv_reader_object = csv.DictReader(csvdatei, delimiter=',')
                for row in csv_reader_object:
                    currentSourceTime = float(row['Source Time'])
                    currentMeatDuration = float(row['MEAT']) - currentSourceTime
                    currentMeatTODuration = float(row['Raptor MEAT TO ExpAT']) - currentSourceTime
                    currentExpAt = float(row['CSA ExpAT'])
                    currentExpAtDuration = float(row['CSA ExpAT']) - currentSourceTime
                    
                    
                    sumEat += float(row['EAT']) - currentSourceTime
                    sumEsat += float(row['ESAT']) - currentSourceTime
                    sumMeat += currentMeatDuration
                    
                    sumRaptorMeatComputedRounds += float(row['Raptor MEAT Computed Rounds'])
                    if float(row['Raptor MEAT Computed Rounds']) > maxRaptorMeatComputedRounds:
                        maxRaptorMeatComputedRounds = float(row['Raptor MEAT Computed Rounds'])
                    sumRaptorMeatResultRound += float(row['Raptor MEAT Rounds Of Result'])
                    if float(row['Raptor MEAT Rounds Of Result']) > maxRaptorMeatResultRound:
                        maxRaptorMeatResultRound = float(row['Raptor MEAT Rounds Of Result'])
                    
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
                    if float(row['CSA MEAT Algorithm']) > maxCSAMeatAlgorithmDuration:
                        maxCSAMeatAlgorithmDuration = float(row['CSA MEAT Algorithm'])
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
                    if float(row['CSA ExpAT Algorithm']) > maxCSAEatAlgorithmDuration:
                        maxCSAEatAlgorithmDuration = float(row['CSA ExpAT Algorithm'])
                    if currentExpAt != 1.7976931348623157e+308:
                        sumCSAEatGraphDuration += float(row['CSA ExpAT Decision Graph'])
                        if float(row['CSA ExpAT Decision Graph']) > maxCSAEatGraphDuration:
                            maxCSAEatGraphDuration = float(row['CSA ExpAT Decision Graph'])
                        successfulCsaExpAtCounter += 1
                        
                        expATMeatAbsDiff = currentExpAtDuration - currentMeatDuration
                        sumExpATMeatAbsDiff += expATMeatAbsDiff
                        if expATMeatAbsDiff > maxExpATMeatAbsDiff:
                            maxExpATMeatAbsDiff = expATMeatAbsDiff
                        expATMeatRelDiff = expATMeatAbsDiff/currentMeatDuration
                        if expATMeatRelDiff > maxExpATMeatRelDiff:
                            maxExpATMeatRelDiff = expATMeatRelDiff
                        sumMeatForExpATResults += currentMeatDuration
                        
                        
                    if alpha == 1:
                        alpha1Values.append(currentMeatDuration)
                    elif alpha == 2:
                        alpha2Values.append(currentMeatDuration)
                    
                    if alpha == 2 or alpha == 3:
                        alpha1AbsDiff = alpha1Values[resultcounter] - currentMeatDuration
                        sumAlpha1AbsDiff += alpha1AbsDiff
                        if alpha1AbsDiff > maxAlpha1AbsDiff:
                            maxAlpha1AbsDiff = alpha1AbsDiff
                        alpha1RelDiff = alpha1AbsDiff/alpha1Values[resultcounter]
                        if alpha1RelDiff > maxAlpha1RelDiff:
                            maxAlpha1RelDiff = alpha1RelDiff
                            
                    if alpha == 3:                        
                        alpha2AbsDiff = alpha2Values[resultcounter] - currentMeatDuration
                        sumAlpha2AbsDiff += alpha2AbsDiff
                        if alpha2AbsDiff > maxAlpha2AbsDiff:
                            maxAlpha2AbsDiff = alpha2AbsDiff
                        alpha2RelDiff = alpha2AbsDiff/alpha2Values[resultcounter]
                        if alpha2RelDiff > maxAlpha2RelDiff:
                            maxAlpha2RelDiff = alpha2RelDiff
                    
                    csaKnownDelayDuration = float(row['CSA AT Known Delay']) - currentSourceTime
                    raptorKnownDelayDuration = float(row['Raptor MEAT AT Known Delay']) - currentSourceTime
                    knownDelayAbsDiff = raptorKnownDelayDuration - csaKnownDelayDuration
                    sumKnownDelayAbsDiff += knownDelayAbsDiff
                    if knownDelayAbsDiff > maxKnownDelayAbsDiff:
                        maxKnownDelayAbsDiff = knownDelayAbsDiff
                    knownDelayRelDiff = knownDelayAbsDiff/csaKnownDelayDuration
                    sumCSAKnownDelay += csaKnownDelayDuration
                    if knownDelayRelDiff > maxKnownDelayRelDiff:
                        if knownDelayRelDiff > 4:
                            print(knownDelayAbsDiff)
                            print(csaKnownDelayDuration)
                            print(knownDelayRelDiff)
                        maxKnownDelayRelDiff = knownDelayRelDiff
                    if csaKnownDelayDuration == raptorKnownDelayDuration:
                        knownDelaySameResultCounter += 1
                        
                    raptorMeatStops = float(row['Raptor MEAT Stops in Graph'])
                    sumRaptorMeatStops += raptorMeatStops
                    if raptorMeatStops > maxRaptorMeatStops:
                        maxRaptorMeatStops = raptorMeatStops
                    raptorMeatLegs = float(row['Raptor MEAT Legs in Graph'])
                    sumRaptorMeatLegs += raptorMeatLegs
                    if raptorMeatLegs > maxRaptorMeatLegs:
                        maxRaptorMeatLegs = raptorMeatLegs
                    raptorMeatEdges = float(row['Raptor MEAT Edges in Graph'])
                    sumRaptorMeatEdges += raptorMeatEdges
                    if raptorMeatEdges > maxRaptorMeatEdges:
                        maxRaptorMeatEdges = raptorMeatEdges
                        
                    raptorMeatTOStops = float(row['Raptor MEAT TO Stops in Graph'])
                    sumRaptorMeatTOStops += raptorMeatTOStops
                    if raptorMeatTOStops > maxRaptorMeatTOStops:
                        maxRaptorMeatTOStops = raptorMeatTOStops
                    raptorMeatTOLegs = float(row['Raptor MEAT TO Legs in Graph'])
                    sumRaptorMeatTOLegs += raptorMeatTOLegs
                    if raptorMeatTOLegs > maxRaptorMeatTOLegs:
                        maxRaptorMeatTOLegs = raptorMeatTOLegs
                    raptorMeatTOEdges = float(row['Raptor MEAT TO Edges in Graph'])
                    sumRaptorMeatTOEdges += raptorMeatTOEdges
                    if raptorMeatTOEdges > maxRaptorMeatTOEdges:
                        maxRaptorMeatTOEdges = raptorMeatTOEdges
                    
                    raptorMeatTOAbsTimeDiff = currentMeatTODuration - currentMeatDuration
                    sumRaptorMeatTOAbsTimeDiff += raptorMeatTOAbsTimeDiff
                    if raptorMeatTOAbsTimeDiff > maxRaptorMeatTOAbsTimeDiff:
                        maxRaptorMeatTOAbsTimeDiff = raptorMeatTOAbsTimeDiff
                    raptorMeatTOAbsTransfersDiff = float(row['Raptor MEAT Rounds Of Result']) - float(row['Raptor MEAT TO Rounds Of Result'])
                    sumRaptorMeatTOAbsTransfersDiff += raptorMeatTOAbsTransfersDiff
                    if raptorMeatTOAbsTransfersDiff > maxRaptorMeatTOAbsTransfersDiff:
                        maxRaptorMeatTOAbsTransfersDiff = raptorMeatTOAbsTransfersDiff
                        
                    raptorMeatTORelTimeDiff = raptorMeatTOAbsTimeDiff/currentMeatDuration
                    if raptorMeatTORelTimeDiff > maxRaptorMeatTORelTimeDiff:
                        maxRaptorMeatTORelTimeDiff = raptorMeatTORelTimeDiff
                    if float(row['Raptor MEAT Rounds Of Result']) > 1:
                        raptorMeatTORelTransfersDiff = raptorMeatTOAbsTransfersDiff/(float(row['Raptor MEAT Rounds Of Result']) - 1)
                        if raptorMeatTORelTransfersDiff > maxRaptorMeatTORelTransfersDiff:
                            maxRaptorMeatTORelTransfersDiff = raptorMeatTORelTransfersDiff
                    
                    for j in range(1, 11):
                        raptorTBDuration = float(row['Raptor MEAT TB Algorithm ' + str(j)])
                        if raptorTBDuration != 0:
                            raptorTBComputedRoundCounter[j-1] += 1
                            sumRaptorTBAbsDuration[j-1] += raptorTBDuration
                            if raptorTBDuration > maxRaptorTBAbsDuration[j-1]:
                                maxRaptorTBAbsDuration[j-1] = raptorTBDuration
                            raptorTBDurationRel = raptorTBDuration/float(row['Raptor MEAT Algorithm'])
                            sumRaptorTBRelDuration[j-1] += raptorTBDurationRel
                            if raptorTBDurationRel > maxRaptorTBRelDuration[j-1]:
                                maxRaptorTBRelDuration[j-1] = raptorTBDurationRel
                            
                            raptorTBMeat = float(row['Raptor MEAT TB ExpAT ' + str(j)])
                            if raptorTBMeat != 0:
                                raptorTBMeat = float(row['Raptor MEAT TB ExpAT ' + str(j)]) - currentSourceTime
                                raptorTBResultCounter[j-1] += 1
                                raptorTBMeatDiff = raptorTBMeat - currentMeatDuration
                                sumRaptorTBAbsExpATDiffs[j-1] += raptorTBMeatDiff
                                if raptorTBMeatDiff > maxRaptorTBAbsExpATDiffs[j-1]:
                                    maxRaptorTBAbsExpATDiffs[j-1] = raptorTBMeatDiff
                                raptorTBMeatRel = raptorTBMeatDiff/currentMeatDuration
                                sumRaptorTBRelExpATDiffs[j-1] += raptorTBMeatRel
                                if raptorTBMeatRel > maxRaptorTBRelExpATDiffs[j-1]:
                                    maxRaptorTBRelExpATDiffs[j-1] = raptorTBMeatRel
                                
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
        
        if alpha == 1:
            alpha1MeatSum = sumMeat
        elif alpha == 2:
            alpha2MeatSum = sumMeat
        
        if alpha == 2 or alpha == 3:
            averageAlpha1AbsDiff = sumAlpha1AbsDiff/resultcounter
            averageAlpha1RelDiff = sumAlpha1AbsDiff/alpha1MeatSum
        
        if alpha == 3:
            averageAlpha2AbsDiff = sumAlpha2AbsDiff/resultcounter
            averageAlpha2RelDiff = sumAlpha2AbsDiff/alpha2MeatSum
            
        averageExpATMeatAbsDiff = sumExpATMeatAbsDiff/successfulCsaExpAtCounter
        averageExpATMeatRelDiff = sumExpATMeatAbsDiff/sumMeatForExpATResults
        unsuccessfulCsaExpAt = resultcounter - successfulCsaExpAtCounter
        relativeUnsuccessfulCsaExpAt = unsuccessfulCsaExpAt/resultcounter
        
        averageKnownDelayAbsDiff = sumKnownDelayAbsDiff/resultcounter
        averageKnownDelayRelDiff = sumKnownDelayAbsDiff/sumCSAKnownDelay
        relativeSameResultKnownDelay = knownDelaySameResultCounter/resultcounter
        
        averageRaptorMeatStops = sumRaptorMeatStops/resultcounter
        averageRaptorMeatLegs = sumRaptorMeatLegs/resultcounter
        averageRaptorMeatEdges = sumRaptorMeatEdges/resultcounter
        
        averageRaptorMeatTOStops = sumRaptorMeatTOStops/resultcounter
        averageRaptorMeatTOLegs = sumRaptorMeatTOLegs/resultcounter
        averageRaptorMeatTOEdges = sumRaptorMeatTOEdges/resultcounter
        
        averageRaptorMeatTOAbsTimeDiff = sumRaptorMeatTOAbsTimeDiff/resultcounter
        averageRaptorMeatTOAbsTransfersDiff = sumRaptorMeatTOAbsTransfersDiff/resultcounter
        
        averageRaptorMeatTORelTimeDiff = sumRaptorMeatTOAbsTimeDiff/sumMeat
        averageRaptorMeatTORelTransfersDiff = sumRaptorMeatTOAbsTransfersDiff/(sumRaptorMeatResultRound - resultcounter)
        
        averageRaptorTBAbsExpATDiffs = [sumRaptorTBAbsExpATDiffs[i]/raptorTBResultCounter[i] for i in range(0, 10)]
        averageRaptorTBRelExpATDiffs = [sumRaptorTBRelExpATDiffs[i]/raptorTBResultCounter[i] for i in range(0, 10)]
        
        averageRaptorTBAbsDuration = [sumRaptorTBAbsDuration[i]/raptorTBComputedRoundCounter[i] for i in range(0, 10)]
        averageRaptorTBRelDuration = [sumRaptorTBRelDuration[i]/raptorTBComputedRoundCounter[i] for i in range(0, 10)]
        
        averageRaptorMeatComputedRounds = sumRaptorMeatComputedRounds/resultcounter
        averageRaptorMeatResultRound = sumRaptorMeatResultRound/resultcounter
        
        relativeNumberOfRaptorTBResults = [raptorTBResultCounter[i]/raptorTBComputedRoundCounter[i] for i in range(0, 10)]
        
        if alpha == 2 and dm == 1:
            dm1Alpha2RaptorMeatTBRelDurations = averageRaptorTBRelDuration
            dm1Alpha2RaptorMeatTBRelNumberOfResults = relativeNumberOfRaptorTBResults
            dm1Alpha2RaptorMeatTBRelExpATDiff = averageRaptorTBRelExpATDiffs
        elif alpha == 2 and dm == 2:
            dm2Alpha2RaptorMeatTBRelDurations = averageRaptorTBRelDuration
            dm2Alpha2RaptorMeatTBRelNumberOfResults = relativeNumberOfRaptorTBResults
            dm2Alpha2RaptorMeatTBRelExpATDiff = averageRaptorTBRelExpATDiffs
            
        print('average eat:', averageEat)
        print('average esat:', averageEsat)
        print('average meat:', averageMeat)
        print('average raptor meat computed rounds:', averageRaptorMeatComputedRounds)
        print('max raptor meat computed rounds:', maxRaptorMeatComputedRounds)
        print('average raptor meat rounds of result:', averageRaptorMeatResultRound)
        print('max raptor meat rounds of result:', maxRaptorMeatResultRound)
        print('')
        print('average raptor meat complete duration:', averageRaptorMeatCompleteDuration)
        print('max raptor meat complete duration:', maxRaptorMeatCompleteDuration)
        print('average raptor meat init duration:', averageRaptorMeatInitDuration)
        print('max raptor meat init duration:', maxRaptorMeatInitDuration)
        print('average raptor meat algorithm duration:', averageRaptorMeatAlgorithmDuration)
        print('max raptor meat algorithm duration:', maxRaptorMeatAlgorithmDuration)
        print('average raptor meat graph duration:', averageRaptorMeatGraphDuration)
        print('max raptor meat graph duration:', maxRaptorMeatGraphDuration)
        print('')
        print('average raptor meat init loop duration:', averageRaptorMeatInitLoopDuration)
        print('average raptor meat init loop duration:', averageRaptorMeatTraverseRoutesLoopDuration)
        print('average raptor meat init loop duration:', averageRaptorMeatUpdateLoopDuration)
        print('')
        print('average csa meat complete duration:', averageCSAMeatCompleteDuration)
        print('max csa meat complete duration:', maxCSAMeatCompleteDuration)
        print('average csa meat init duration:', averageCSAMeatInitDuration)
        print('max csa meat init duration:', maxCSAMeatInitDuration)
        print('average csa meat algorithm duration:', averageCSAMeatAlgorithmDuration)
        print('max csa meat algorithm duration:', maxCSAMeatAlgorithmDuration)
        print('average csa meat graph duration:', averageCSAMeatGraphDuration)
        print('max csa meat graph duration:', maxCSAMeatGraphDuration)
        print('')
        print('average csa expat complete duration:', averageCSAEatCompleteDuration)
        print('max csa expat complete duration:', maxCSAEatCompleteDuration)
        print('average csa expat init duration:', averageCSAEatInitDuration)
        print('max csa expat init duration:', maxCSAEatInitDuration)
        print('average csa expat algorithm duration:', averageCSAEatAlgorithmDuration)
        print('max csa expat algorithm duration:', maxCSAEatAlgorithmDuration)
        print('average csa expat graph duration:', averageCSAEatGraphDuration)
        print('max csa expat graph duration:', maxCSAEatGraphDuration)
        if alpha == 2 or alpha == 3:
            print('')
            print('average alpha 1 absolute difference:', averageAlpha1AbsDiff)
            print('max alpha 1 absolute difference:', maxAlpha1AbsDiff)
            print('average alpha 1 relative difference:', averageAlpha1RelDiff)
            print('max alpha 1 relative difference:', maxAlpha1RelDiff)
        if alpha == 3:
            print('')
            print('average alpha 2 absolute difference:', averageAlpha2AbsDiff)
            print('max alpha 2 absolute difference:', maxAlpha2AbsDiff)
            print('average alpha 2 relative difference:', averageAlpha2RelDiff)
            print('max alpha 2 relative difference:', maxAlpha2RelDiff)
        print('')
        print('average expat meat absolute difference:', averageExpATMeatAbsDiff)
        print('max expat meat absolute difference:', maxExpATMeatAbsDiff)
        print('average expat meat relative difference:', averageExpATMeatRelDiff)
        print('max expat meat relative difference:', maxExpATMeatRelDiff)
        print('absolute number of unsuccessful expat:', unsuccessfulCsaExpAt)
        print('relative unsuccessful expat:', relativeUnsuccessfulCsaExpAt)
        print('')
        print('average known delay absolute difference:', averageKnownDelayAbsDiff)
        print('max known delay absolute difference:', maxKnownDelayAbsDiff)
        print('average known delay relative difference:', averageKnownDelayRelDiff)
        print('max known delay relative difference:', maxKnownDelayRelDiff)
        print('absolute number of same known delay results:', knownDelaySameResultCounter)
        print('relative number of same known delay results:', relativeSameResultKnownDelay)
        print('')
        print('raptor meat average number of stops:', averageRaptorMeatStops)
        print('raptor meat max number of stops:', maxRaptorMeatStops)
        print('raptor meat average number of legs:', averageRaptorMeatLegs)
        print('raptor meat max number of legs:', maxRaptorMeatLegs)
        print('raptor meat average number of edges:', averageRaptorMeatEdges)
        print('raptor meat max number of edges:', maxRaptorMeatEdges)
        print('')
        print('raptor meat to average number of stops:', averageRaptorMeatTOStops)
        print('raptor meat to max number of stops:', maxRaptorMeatTOStops)
        print('raptor meat to average number of legs:', averageRaptorMeatTOLegs)
        print('raptor meat to max number of legs:', maxRaptorMeatTOLegs)
        print('raptor meat to average number of edges:', averageRaptorMeatTOEdges)
        print('raptor meat to max number of edges:', maxRaptorMeatTOEdges)
        print('')
        print('average raptor meat - to absolute time difference:', averageRaptorMeatTOAbsTimeDiff)
        print('max raptor meat - to absolute time difference:', maxRaptorMeatTOAbsTimeDiff)
        print('average raptor meat - to absolute transfers difference:', averageRaptorMeatTOAbsTransfersDiff)
        print('max raptor meat - to absolute transfers difference:', maxRaptorMeatTOAbsTransfersDiff)
        print('')
        print('average raptor meat - to relative time difference:', averageRaptorMeatTORelTimeDiff)
        print('max raptor meat - to relative time difference:', maxRaptorMeatTORelTimeDiff)
        print('average raptor meat - to relative transfers difference:', averageRaptorMeatTORelTransfersDiff)
        print('max raptor meat - to relative transfers difference:', maxRaptorMeatTORelTransfersDiff)
        print('')
        print('number of raptor tb computed rounds:')
        print(raptorTBComputedRoundCounter)
        print('average raptor tb algorithm absolute durations:')
        print(averageRaptorTBAbsDuration)
        print('max raptor tb algorithm absolute durations:')
        print(maxRaptorTBAbsDuration)
        print('average raptor tb algorithm relative durations:')
        print(averageRaptorTBRelDuration)
        print('max raptor tb algorithm relative durations:')
        print(maxRaptorTBRelDuration)
        print('')
        print('number of raptor tb results:')
        print(raptorTBResultCounter)
        print('relative number of raptor tb results:')
        print(relativeNumberOfRaptorTBResults)
        print('average raptor tb expat absolute difference:')
        print(averageRaptorTBAbsExpATDiffs)
        print('max raptor tb expat absolute difference:')
        print(maxRaptorTBAbsExpATDiffs)
        print('average raptor tb expat relative difference:')
        print(averageRaptorTBRelExpATDiffs)
        print('max raptor tb expat relative difference:')
        print(maxRaptorTBRelExpATDiffs)
        
#data
x0 = [i for i in range(1, 11)]
x1 = [i for i in range(1, 11)]


#create plot
# =============================================================================
# plt.plot(x0,dm1Alpha2RaptorMeatTBRelDurations)
# plt.plot(x1,dm2Alpha2RaptorMeatTBRelDurations)
# plt.xticks([i for i in range(1, 11)])
# plt.xlabel("Runde")
# plt.ylabel("Relative Laufzeit")
# plt.legend(["DM1", "DM2"], title="Verspätungsmodell")
# plt.savefig("raptorMeatTBRelDurations.png", format = 'png', dpi = 1200, bbox_inches= 'tight')
# plt.show()
# plt.close()
# 
# #create plot
# plt.plot(x0,dm1Alpha2RaptorMeatTBRelNumberOfResults)
# plt.plot(x1,dm2Alpha2RaptorMeatTBRelNumberOfResults)
# plt.xticks([i for i in range(1, 11)])
# plt.xlabel("Runde")
# plt.ylabel("Relative Anzahl an ExpATs")
# plt.legend(["DM1", "DM2"], title="Verspätungsmodell")
# plt.savefig("raptorMeatTBRelNumberOfResults.png", format = 'png', dpi = 1200, bbox_inches= 'tight')
# plt.show()
# plt.close()
# 
# #create plot
# plt.plot(x0,dm1Alpha2RaptorMeatTBRelExpATDiff)
# plt.plot(x1,dm2Alpha2RaptorMeatTBRelExpATDiff)
# plt.xticks([i for i in range(1, 11)])
# plt.xlabel("Runde")
# plt.ylabel("Relative Differenz der ExpAT")
# plt.legend(["DM1", "DM2"], title="Verspätungsmodell")
# plt.savefig("raptorMeatTBRelExpATDiff.png", format = 'png', dpi = 1200, bbox_inches= 'tight')
# plt.show()
# plt.close()
# =============================================================================
