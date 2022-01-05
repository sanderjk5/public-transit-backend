# -*- coding: utf-8 -*-
"""
Created on Sun Dec 12 13:06:40 2021

@author: Jurek
"""

import csv

for dm in range(1, 3):
    print('')
    print('dm: ', dm)
    
    for alpha in range(1, 4):
        print('')
        print('alpha: ', alpha)
        print('')
        
        sumApproxMeatAbsDiff = 0
        
        sumMeat = 0
        
        resultCounter = 0
        
        for i in range(0, 20):
            path = 'approx_dm' + str(dm) + '_alpha' + str(alpha) + 'v' + str(i) + '.csv'
            with open(path) as csvdatei:
                csv_reader_object = csv.DictReader(csvdatei, delimiter=',')
                for row in csv_reader_object:
                    currentSourceTime = float(row['Source Time'])
                    currentMeatDuration = float(row['MEAT']) - currentSourceTime
                    sumMeat += currentMeatDuration
                    
                    absDiff = abs(float(row['MEAT']) - float(row['Approximated MEAT']))
                    sumApproxMeatAbsDiff += absDiff
                    
                    resultCounter += 1
        
        averageApproxMeatAbsDiff = sumApproxMeatAbsDiff/resultCounter
        averageApproxMeatRelDiff = sumApproxMeatAbsDiff/sumMeat
        
        print('average approx meat absolute difference:', averageApproxMeatAbsDiff)
        print('average approx meat relative difference:', averageApproxMeatRelDiff)