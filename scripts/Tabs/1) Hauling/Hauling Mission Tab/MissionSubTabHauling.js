import React, { useState, useRef, useEffect, useCallback } from 'react';
import Select from 'react-select';
import { logAddEntry, logProcessOrders, logMissionGrouping, logStatusChange } from '../../7) Debug Options/HaulingDebugLogs';
import crypto from 'crypto';

export const MissionSubTabHauling = ({
    data,
    entries,
    setEntries,
    selectedMissions,
    setSelectedMissions,
    missionEntries,
    setMissionEntries,
    selectedDropOffPoint,
    selectedCommodity,
    firstDropdownValue,
    secondDropdownValue,
    selectedPlanet,
    selectedMoon,
    showBannerMessage,
    // Add missing props
    STATUS_OPTIONS,
    customStyles,
    handleCommoditySelectChange,
    handleSelectChange,
    handleAmountKeyPress,
    handleTopAmountKeyPress,
    toggleCollapse,
    clearLog,
    handlePlanetSelectChange,
    collapsed,
    isAlternateTable,
    setIsAlternateTable,
    collapsedMissions,
    setCollapsedMissions,
    missionRewards,
    setMissionRewards,
    locationType,
    setLocationType,
    setSelectedPlanet,
    setSelectedMoon,
    setSelectedDropOffPoint,
    setFirstDropdownValue,
    setSecondDropdownValue,
    planetOptions,
    stationOptions,
    commodityOptions,
    pickupPointOptions,
    quickLookupOptions,
    handleLocationTypeChange,
    handleMoonSelectChange,
    handleStationSelectChange,
    handleDropOffSelectChange,
    handlePickupPointChange,
    handleQuickLookupChange,
    updateCargo,
    removeCargo,
    moveDropOffPoint,
    markAsDelivered,
    debugFlags,
    setPayoutEntries,
    calculateTotalSCU,
    amountInputRef,
    setHistoryEntries,
    addOCRToManifest
}) => {
    // Local state
    const [needsClearConfirmation, setNeedsClearConfirmation] = useState(false);
    const [autoMissionAllocation, setAutoMissionAllocation] = useState(() => {
        const saved = localStorage.getItem('autoMissionAllocation');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [isSettingKey, setIsSettingKey] = useState(false);

    // Ref to track the locked mission index in auto mode
    const lockedMissionIndex = useRef(null);

    const [nextMissionHotkey, setNextMissionHotkey] = useState(() => {
        const savedHotkey = localStorage.getItem('nextMissionHotkey');
        return savedHotkey || 'N'; // Default to 'n'
    });

    // Add effect to save state changes
    useEffect(() => {
        localStorage.setItem('autoMissionAllocation', JSON.stringify(autoMissionAllocation));
    }, [autoMissionAllocation]);

    useEffect(() => {
        localStorage.setItem('nextMissionHotkey', nextMissionHotkey);
    }, [nextMissionHotkey]);

    const handleCheckboxChange = (index) => {
        setSelectedMissions(prev => {
            // Create a new array with all checkboxes unselected
            const updated = Array(prev.length).fill(false);
            // Set only the clicked checkbox to true
            updated[index] = !prev[index];
            localStorage.setItem('selectedMissions', JSON.stringify(updated));
            return updated;
        });
    };

    const addEntry = () => {
        logAddEntry(debugFlags, 'Adding new entry', {
            commodity: selectedCommodity,
            amount: document.querySelector('.amount-input').value,
            dropOffPoint: selectedDropOffPoint
        });
        const amountValue = document.querySelector('.amount-input').value;
        if (!selectedDropOffPoint) {
            showBannerMessage('Please select a drop-off point or station.');
            return;
        }
        if (!amountValue || amountValue <= 0) {
            showBannerMessage('Please enter a valid amount greater than 0.');
            return;
        }

        let selectedMissionIndex = null;
        let isMissionEntry = false;

        if (autoMissionAllocation) {
            // Use lockedMissionIndex if available, otherwise find next available
            if (lockedMissionIndex.current !== null) {
                selectedMissionIndex = lockedMissionIndex.current;
            } else {
                selectedMissionIndex = missionEntries.findIndex(mission => !mission || mission.length === 0);
            }

            // If no available missions, create a new one (up to a limit)
            if (selectedMissionIndex === -1 && missionEntries.length < 15) {
                selectedMissionIndex = missionEntries.length;
            }

            if (selectedMissionIndex === -1) {
                showBannerMessage('No available missions. Please clear a mission or disable automatic allocation.');
                return;
            }
            isMissionEntry = true;

            // If a new mission is being used, lock it
            if (lockedMissionIndex.current === null) {
                lockedMissionIndex.current = selectedMissionIndex;
            }
        } else {
            // Manual mode: Only set as mission entry if a checkbox is selected
            selectedMissionIndex = selectedMissions.findIndex(mission => mission);
            isMissionEntry = selectedMissionIndex !== -1;
        }

        const newEntry = {
            id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            missionIndex: isMissionEntry ? selectedMissionIndex : null,
            dropOffPoint: selectedDropOffPoint,
            commodity: selectedCommodity,
            originalAmount: amountValue,
            currentAmount: amountValue,
            status: STATUS_OPTIONS[0],
            pickupPoint: firstDropdownValue,
            pickup: firstDropdownValue,
            planet: selectedPlanet,
            moon: selectedMoon,
            isMissionEntry,
            timestamp: Date.now()
        };

        setEntries(prevEntries => {
            const updatedEntries = [...prevEntries, newEntry];
            localStorage.setItem('entries', JSON.stringify(updatedEntries));
            return updatedEntries;
        });

        if (isMissionEntry) {
            setMissionEntries(prev => {
                const updated = [...prev];
                if (!updated[selectedMissionIndex]) {
                    updated[selectedMissionIndex] = [];
                }
                updated[selectedMissionIndex] = [...updated[selectedMissionIndex], { ...newEntry }];
                localStorage.setItem('missionEntries', JSON.stringify(updated));
                return updated;
            });
        }

        if (amountInputRef.current) {
            amountInputRef.current.focus();
            amountInputRef.current.select();
        }
    };

    // Helper function to find the next available mission index
    const getNextAvailableMissionIndex = () => {
        const nextIndex = missionEntries.findIndex(mission => !mission || mission.length === 0);
         // If all missions are full, but we haven't reached the limit, return the next index
        if (nextIndex === -1 && missionEntries.length < 15) {
            return missionEntries.length;
        }
        return nextIndex; // Return -1 if all missions are full AND we reached the limit
    };

    // Function to unlock the mission
    const unlockMission = () => {
        lockedMissionIndex.current = null;
        forceUpdate();
    };

    const toggleMissionCollapse = (index) => {
        setCollapsedMissions(prev => {
            const updated = [...prev];
            updated[index] = !updated[index];
            localStorage.setItem('collapsedMissions', JSON.stringify(updated));
            return updated;
        });
    };

    const handleRewardChange = (missionId, value) => {
        const numericValue = value.replace(/\D/g, '');
        const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        setMissionRewards(prev => {
            const updated = {
                ...prev,
                [missionId]: formattedValue
            };
            localStorage.setItem('missionRewards', JSON.stringify(updated));
            return updated;
        });
    };

    const getMissionPreview = (missionIndex) => {
        const missionEntriesForIndex = missionEntries[missionIndex];
        
        if (!missionEntriesForIndex) return null;

        return (
            <div className="tooltip">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Drop off points</th>
                            <th>Commodity</th>
                            <th>QTY</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {missionEntriesForIndex.map((entry, index) => (
                            <tr key={index}>
                                <td>{entry.dropOffPoint}</td>
                                <td>{entry.commodity}</td>
                                <td>{entry.currentAmount}/{entry.originalAmount}</td>
                                <td>{entry.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const toggleTableView = () => {
        setIsAlternateTable(!isAlternateTable);
    };

    const formatAmount = (current, original) => {
        if (!original) return null;
        
        const currentNum = Number(current) || 0;
        const originalNum = Number(original);
        
        return `${currentNum}/${originalNum}`;
    };

    // --- New: Simulate "Next Mission" Click ---
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key.toUpperCase() === nextMissionHotkey.toUpperCase() && autoMissionAllocation) {
                unlockMission();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [nextMissionHotkey, autoMissionAllocation]);

    const handleHotkeyChange = (event) => {
        setNextMissionHotkey(event.target.value);
    };
    // --- End New ---

    const handleSetKeyClick = () => {
        setIsSettingKey(true);
        const handleKeyDown = (event) => {
            event.preventDefault(); // Prevent the default action
            const newHotkey = event.key;
            localStorage.setItem('nextMissionHotkey', newHotkey);
            setNextMissionHotkey(newHotkey);
            setIsSettingKey(false);
            window.removeEventListener('keydown', handleKeyDown);
        };

        window.addEventListener('keydown', handleKeyDown, { once: true });
    };

    const handleClearLog = () => {
        if (needsClearConfirmation) {
            logProcessOrders(debugFlags, 'Clearing log');
            setEntries([]);
            setMissionEntries(Array(15).fill(null));
            setMissionRewards({});
            localStorage.removeItem('entries');
            localStorage.removeItem('missionEntries');
            localStorage.removeItem('missionRewards');
            setNeedsClearConfirmation(false);

            // Reset lockedMissionIndex to null when clearing the log
            lockedMissionIndex.current = null;

            // Force a re-render to update the mission checkbox
            forceUpdate();
        } else {
            showBannerMessage('Are you sure? Click again to clear the log.');
            setNeedsClearConfirmation(true);
            setTimeout(() => setNeedsClearConfirmation(false), 3000);
        }
    };

    // Function to force a re-render of the component
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []);

    const addToHistoryFromManifest = () => {
        // Get all delivered entries from manifest, only check delivery status
        const deliveredEntries = entries.filter(entry => 
            entry.status === 'Delivered'
        );

        console.log('All entries:', entries);
        console.log('Delivered entries:', deliveredEntries);
        console.log('Entry statuses:', entries.map(e => ({
            status: e.status,
            id: e.id
        })));

        if (deliveredEntries.length === 0) {
            showBannerMessage('No delivered entries to process');
            return;
        }

        // Format entries for history, ensuring status is properly set
        const historyEntries = deliveredEntries.map(entry => {
            // Calculate delivery percentage
            const current = Number(entry.currentAmount) || 0;
            const original = Number(entry.originalAmount) || 0;
            const deliveryPercentage = original > 0 ? (current / original) * 100 : 0;

            // Determine status based on delivery percentage
            const status = deliveryPercentage < 49 ? 'Failed' : 'Delivered';

            return {
                pickup: entry.pickup || entry.pickupPoint,
                commodity: entry.commodity,
                currentAmount: entry.currentAmount,
                originalAmount: entry.originalAmount,
                dropOffPoint: entry.dropOffPoint,
                status: status,
                date: new Date().toISOString(),
                planet: entry.planet,
                moon: entry.moon
            };
        });

        // Get existing history entries
        const existingHistory = JSON.parse(localStorage.getItem('historyEntries')) || [];
        
        // Combine with new entries
        const updatedHistory = [...existingHistory, ...historyEntries];
        
        // Update history state and localStorage
        setHistoryEntries(updatedHistory);
        localStorage.setItem('historyEntries', JSON.stringify(updatedHistory));

        // Remove processed entries from manifest, only check delivery status
        const remainingEntries = entries.filter(entry => 
            entry.status !== 'Delivered'
        );
        setEntries(remainingEntries);
        localStorage.setItem('entries', JSON.stringify(remainingEntries));

        showBannerMessage('Entries processed to history successfully');

        // After processing manifest entries, call the mission processing function
        addMissionEntriesToPayouts();
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const addMissionEntriesToPayouts = () => {
        // Get all delivered mission entries
        const deliveredMissionEntries = entries.filter(entry => 
            entry.status === 'Delivered' && entry.isMissionEntry
        );

        if (deliveredMissionEntries.length === 0) {
            console.log('No mission entries to process');
            return;
        }

        // Group entries by mission index
        const entriesByMission = deliveredMissionEntries.reduce((acc, entry) => {
            const missionIndex = entry.missionIndex;
            if (!acc[missionIndex]) {
                acc[missionIndex] = [];
            }
            acc[missionIndex].push(entry);
            return acc;
        }, {});

        console.log('Grouped Mission Entries:', entriesByMission);

        // Format entries for payouts
        const formattedPayoutEntries = Object.entries(entriesByMission).map(([missionIndex, missionEntries]) => {
            // Generate a single missionId for the entire group
            const missionId = generateUUID();
            return missionEntries.map(entry => {
                // Calculate delivery percentage
                const current = Number(entry.currentAmount) || 0;
                const original = Number(entry.originalAmount) || 0;
                const deliveryPercentage = original > 0 ? ((current / original) * 100).toFixed(2) : '0';

                return {
                    id: generateUUID(),
                    missionId: missionId, // Use the same missionId for all entries in this group
                    commodity: entry.commodity,
                    amount: `${entry.currentAmount}/${entry.originalAmount}`,
                    pickup: entry.pickup || entry.pickupPoint,
                    dropOffPoint: entry.dropOffPoint,
                    status: 'Completed',
                    date: new Date().toISOString(),
                    reward: missionRewards[`mission_${entry.missionIndex}`] || '0',
                    missionIndex: entry.missionIndex,
                    originalAmount: entry.originalAmount,
                    currentAmount: entry.currentAmount,
                    percentage: deliveryPercentage // Add percentage to payout entry
                };
            });
        }).flat();

        console.log('Formatted Payout Entries:', formattedPayoutEntries);

        // Get existing payouts
        const existingPayouts = JSON.parse(localStorage.getItem('payoutEntries')) || [];
        console.log('Existing Payouts:', existingPayouts);
        
        // Combine with new entries
        const updatedPayouts = [...existingPayouts, ...formattedPayoutEntries];
        console.log('Updated Payouts:', updatedPayouts);
        
        // Ensure unique mission names
        const uniquePayouts = updatedPayouts.map((entry, index, array) => {
            let missionName = `Mission ${entry.missionIndex + 1}`;
            let count = 1;
            while (array.some(e => e !== entry && e.missionId === entry.missionId && e.missionName === missionName)) {
                missionName = `Mission ${entry.missionIndex + 1} (${count++})`
            }
            return { ...entry, missionName };
        });

        // Update both localStorage AND state
        localStorage.setItem('payoutEntries', JSON.stringify(uniquePayouts));
        setPayoutEntries(uniquePayouts); // Update state

        // Update mission entries state
        setMissionEntries(prevMissionEntries => {
            const updatedMissionEntries = prevMissionEntries.map(mission => {
                if (!mission) return mission;
                return mission.filter(entry => !deliveredMissionEntries.find(de => de.id === entry.id));
            });
            localStorage.setItem('missionEntries', JSON.stringify(updatedMissionEntries));
            return updatedMissionEntries;
        });

        // Clear rewards for processed missions
        const updatedRewards = { ...missionRewards };
        Object.keys(entriesByMission).forEach(missionIndex => {
            delete updatedRewards[`mission_${missionIndex}`];
        });
        setMissionRewards(updatedRewards);
        localStorage.setItem('missionRewards', JSON.stringify(updatedRewards));

        showBannerMessage('Mission entries processed to payouts successfully');
    };

    return (
        <div className="hauling-missions">
            
            <div className="form-row">
                <div className="form-group">
                    <label>Pickup Point</label>
                    <Select
                        components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                        options={pickupPointOptions}
                        value={pickupPointOptions.find(option => option.value === firstDropdownValue)}
                        onChange={(option) => {
                            handlePickupPointChange(option);
                            if (amountInputRef.current) {
                                amountInputRef.current.focus();
                            }
                        }}
                        className="first-dropdown-select"
                        classNamePrefix="react-select"
                        styles={customStyles}
                        placeholder="Search Pickup Point"
                    />
                </div>
                <div className="form-group">
                    <label>Quick Lookup</label>
                    <Select
                        components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                        options={quickLookupOptions}
                        value={quickLookupOptions.find(option => option.value === secondDropdownValue)}
                        onChange={(option) => {
                            handleQuickLookupChange(option);
                            if (amountInputRef.current) {
                                amountInputRef.current.focus();
                            }
                        }}
                        className="second-dropdown-select"
                        classNamePrefix="react-select"
                        styles={customStyles}
                        placeholder="Search Quick Lookup"
                    />
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label>Location Type</label>
                    <Select
                        components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                        options={[
                            { value: 'planet', label: 'Planet' },
                            { value: 'station', label: 'Station' }
                        ]}
                        value={{ value: locationType, label: locationType.charAt(0).toUpperCase() + locationType.slice(1) }}
                        onChange={handleLocationTypeChange}
                        className="location-type-select"
                        classNamePrefix="react-select"
                        styles={customStyles}
                    />
                </div>
                {locationType === 'planet' ? (
                    <>
                        <div className="form-group">
                            <label>Planet</label>
                            <Select
                                components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                                options={planetOptions}
                                value={planetOptions.find(option => option.value === selectedPlanet)}
                                onChange={handlePlanetSelectChange}
                                className="planet-select"
                                classNamePrefix="react-select"
                                styles={customStyles}
                            />
                        </div>
                        <div className="form-group">
                            <label>Moon</label>
                            <Select
                                components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                                options={selectedPlanet && data.moons[selectedPlanet] ? 
                                    Object.keys(data.moons[selectedPlanet]).map(moon => ({ value: moon, label: moon })) : 
                                    []}
                                value={selectedMoon ? { value: selectedMoon, label: selectedMoon } : null}
                                onChange={handleMoonSelectChange}
                                className="moon-select"
                                classNamePrefix="react-select"
                                styles={customStyles}
                            />
                        </div>
                    </>
                ) : (
                    <div className="form-group">
                        <label>Station</label>
                        <Select
                            components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                            options={stationOptions}
                            value={stationOptions.find(option => option.value === selectedDropOffPoint)}
                            onChange={handleStationSelectChange}
                            className="station-select"
                            classNamePrefix="react-select"
                            styles={customStyles}
                        />
                    </div>
                )}
                <div className="form-group">
                    <label>Drop off points</label>
                    <Select
                        components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                        options={selectedMoon && data.moons[selectedPlanet][selectedMoon] ? 
                            data.moons[selectedPlanet][selectedMoon].map(station => ({ value: station, label: station })) : 
                            (data.Dropoffpoints[selectedPlanet] || []).map(station => ({ value: station, label: station }))}
                        value={selectedDropOffPoint ? { value: selectedDropOffPoint, label: selectedDropOffPoint } : null}
                        onChange={handleDropOffSelectChange}
                        className="drop-off-select"
                        classNamePrefix="react-select"
                        styles={customStyles}
                        placeholder="Select Drop off"
                    />
                </div>
            </div>

            {/* Mission Selection Area */}
            <div className="mission-checkbox" style={{ 
                minHeight: '140px',
                fontFamily: 'Arial, sans-serif !important'
            }}>
                <div style={{
                    marginBottom: '10px',
                    textAlign: 'center',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'Arial, sans-serif'
                }}>
                    <label
                        className="automatic-mission-label"
                        style={{
                            cursor: 'pointer',
                            color: autoMissionAllocation ? 'green' : 'var(--mission-text-color)',
                            userSelect: 'none',
                            textDecoration: 'underline',
                            fontSize: '1.2em',
                            fontWeight: 'bold',
                            fontFamily: 'Arial, sans-serif'
                        }}
                        onClick={() => setAutoMissionAllocation(!autoMissionAllocation)}
                    >
                        Automatic Mission Allocation
                    </label>
                </div>

                {/* Conditionally render based on autoMissionAllocation */}
                {autoMissionAllocation ? (
                    // Auto Mode: Only first 5 checkboxes + Unlock Button
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        minHeight: '130px',
                        fontFamily: 'Arial, sans-serif'
                    }}>
                        <div className="column" style={{ 
                            flex: 1,
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            {/* Display only one mission checkbox in auto mode */}
                            {Array.from({ length: 1 }, (_, index) => {
                                // Correct Mission Number Calculation:
                                let missionNumber;
                                if (lockedMissionIndex.current !== null) {
                                    missionNumber = lockedMissionIndex.current + 1; // Always show locked mission number
                                } else {
                                     missionNumber = getNextAvailableMissionIndex() + index + 1;
                                        // Prevent displaying a number greater than 15
                                        if (missionNumber > 15) {
                                             missionNumber = Math.min(getNextAvailableMissionIndex() + index + 1, 15); // Cap at 15
                                        }
                                 }
                                const isLockedMission = lockedMissionIndex.current !== null && (lockedMissionIndex.current % 5) === index;

                                return (
                                    <label key={index} style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center',
                                        fontFamily: 'Arial, sans-serif'
                                    }}>
                                        <span style={{ 
                                            textDecoration: 'underline', 
                                            marginBottom: '5px', 
                                            textAlign: 'center',
                                            fontFamily: 'Arial, sans-serif'
                                        }}>Current Mission</span>
                                        <input
                                            type="checkbox"
                                            checked={isLockedMission}
                                            onChange={() => {
                                                if (!isLockedMission) {
                                                    handleCheckboxChange(index);
                                                }
                                            }}
                                            style={{ display: 'none' }}
                                        />
                                        Mission {missionNumber}
                                        {getMissionPreview(lockedMissionIndex.current !== null ? lockedMissionIndex.current : (getNextAvailableMissionIndex() + index))}
                                    </label>
                                );
                            })}
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-end', 
                            flex: 0, 
                            minWidth: '120px',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            <button onClick={unlockMission} className="unlock-mission-button" style={{
                                marginBottom: '10px', 
                                whiteSpace: 'nowrap',
                                fontFamily: 'Arial, sans-serif'
                            }}>
                                Next Mission
                            </button>
                            <button 
                                onClick={handleSetKeyClick} 
                                className="set-key-button" 
                                style={{
                                    marginBottom: '10px', 
                                    whiteSpace: 'nowrap',
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                    display: 'block',
                                    fontFamily: 'Arial, sans-serif'
                                }}
                                disabled={isSettingKey}
                            >
                                {isSettingKey ? 'Press Key...' : `Set Key: ${nextMissionHotkey.toUpperCase()}`}
                            </button>
                        </div>
                    </div>
                ) : (
                    // Manual Mode: All checkboxes
                    <>
                        <div className="column" style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-end', 
                            marginRight: '10px', 
                            minHeight: '130px',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            {Array.from({ length: 5 }, (_, index) => {
                                const missionNumber = index + 1;
                                return (
                                    <label 
                                        key={index} 
                                        style={{ 
                                            marginBottom: '0px',
                                            textDecoration: selectedMissions[index] ? 'underline' : 'none',
                                            textShadow: selectedMissions[index] ? '0 0 5px var(--button-color)' : 'none',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMissions[index]}
                                            style={{
                                                display: autoMissionAllocation ? 'none' : 'block',
                                                marginRight: '5px'
                                            }}
                                            onChange={() => handleCheckboxChange(index)}
                                        />
                                        <span style={{ 
                                            color: autoMissionAllocation ? 'grey' : 'var(--mission-text-color)',
                                            fontFamily: 'Arial, sans-serif'
                                        }}>
                                            Mission {index + 1}
                                        </span>
                                        {getMissionPreview(index)}
                                    </label>
                                );
                            })}
                        </div>
                        <div className="column" style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-end', 
                            marginRight: '10px', 
                            minHeight: '130px',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            {Array.from({ length: 5 }, (_, index) => {
                                const missionNumber = index + 6;
                                return (
                                    <label 
                                        key={index + 5} 
                                        style={{ 
                                            marginBottom: '0px',
                                            textDecoration: selectedMissions[index + 5] ? 'underline' : 'none',
                                            textShadow: selectedMissions[index + 5] ? '0 0 5px var(--button-color)' : 'none',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMissions[index + 5]}
                                            style={{
                                                display: autoMissionAllocation ? 'none' : 'block',
                                                marginRight: '5px'
                                            }}
                                            onChange={() => handleCheckboxChange(index + 5)}
                                        />
                                        <span style={{ 
                                            color: autoMissionAllocation ? 'grey' : 'var(--mission-text-color)',
                                            fontFamily: 'Arial, sans-serif'
                                        }}>
                                            Mission {index + 6}
                                        </span>
                                        {getMissionPreview(index + 5)}
                                    </label>
                                );
                            })}
                        </div>
                        <div className="column" style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-end', 
                            marginRight: '10px', 
                            minHeight: '130px',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            {Array.from({ length: 5 }, (_, index) => {
                                const missionNumber = index + 11;
                                return (
                                    <label 
                                        key={index + 10} 
                                        style={{ 
                                            marginBottom: '0px',
                                            textDecoration: selectedMissions[index + 10] ? 'underline' : 'none',
                                            textShadow: selectedMissions[index + 10] ? '0 0 5px var(--button-color)' : 'none',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            display: 'flex',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMissions[index + 10]}
                                            style={{
                                                display: autoMissionAllocation ? 'none' : 'block',
                                                marginRight: '5px'
                                            }}
                                            onChange={() => handleCheckboxChange(index + 10)}
                                        />
                                        <span style={{ 
                                            color: autoMissionAllocation ? 'grey' : 'var(--mission-text-color)',
                                            fontFamily: 'Arial, sans-serif'
                                        }}>
                                            Mission {index + 11}
                                        </span>
                                        {getMissionPreview(index + 10)}
                                    </label>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Commodity and Amount Form */}
            <div className="form-row">
                <div className="form-group">
                    <label>Commodity</label>
                    <Select
                        components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                        options={commodityOptions}
                        value={commodityOptions.find(option => option.value === selectedCommodity)}
                        onChange={handleCommoditySelectChange}
                        className="commodity-select"
                        classNamePrefix="react-select"
                        styles={customStyles}
                    />
                </div>
                <div className="form-group">
                    <label>Amount</label>
                    <input
                        type="text"
                        className="amount-input"
                        ref={amountInputRef}
                        onKeyDown={(e) => {
                            if (e.key.toUpperCase() === nextMissionHotkey.toUpperCase() && autoMissionAllocation) {
                                unlockMission();
                            }
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                addEntry();
                            }
                            // Only allow numbers and prevent other characters
                            if (!/^\d$/.test(e.key)) {
                                e.preventDefault();
                            }
                        }}
                    />
                </div>
                <div className="form-group button-group">
                    <button className="add-entry-button" onClick={addEntry}>Add Entry</button>
                    <button className="table-view-button" onClick={toggleTableView}>
                        {isAlternateTable ? 'Manifest' : 'Missions'}
                    </button>
                    <button className="process-orders-button" onClick={addToHistoryFromManifest}>Process Order</button>
                    <form onSubmit={(e) => e.preventDefault()}>
                        <button
                            type="button"
                            className="clear-log-button"
                            onClick={handleClearLog}
                        >
                            Clear Log
                        </button>
                    </form>
                    <label htmlFor="scuTotal">Total SCU:</label>
                    <input
                        id="scuTotal"
                        type="text"
                        value={calculateTotalSCU()}
                        readOnly
                        className="scu-total-input"
                    />
                </div>
            </div>

            {/* Table Label */}
            <div style={{ width: '100%', textAlign: 'center' }}>
                <h2 style={{ 
                    color: 'var(--title-color)', 
                    margin: '2px auto',
                    padding: '0 10px 2px',
                    display: 'inline-block',
                    borderBottom: '2px solid var(--title-color)'
                }}>
                    {isAlternateTable ? 'Missions Manifest' : 'Hauling Manifest'}
                </h2>
            </div>

            {/* Table Container */}
            <div className="table-container">
                {isAlternateTable ? (
                    // Mission View
                    (() => {
                        const maxMissionIndex = Math.max(
                            ...missionEntries.map((_, index) => index),
                            ...Object.keys(missionRewards)
                                .map(key => parseInt(key.replace('mission_', '')))
                                .filter(num => !isNaN(num))
                        );
                        
                        return Array.from({ length: Math.max(maxMissionIndex + 2, 1) }, (_, missionIndex) => {
                            // Only show mission if it has entries or a reward
                            const hasMissionEntries = missionEntries[missionIndex]?.length > 0;
                            const hasReward = missionRewards[`mission_${missionIndex}`];
                            
                            if (!hasMissionEntries && !hasReward) return null;

                            return (
                                <div key={missionIndex}>
                                    <div className="drop-off-header" onClick={() => toggleMissionCollapse(missionIndex)}>
                                        <div className="left-box">
                                            <span>Mission {missionIndex + 1}</span>
                                        </div>
                                        <div className="right-box">
                                            <div className="reward-input-container">
                                                <input
                                                    type="text"
                                                    className="mission-reward-mission-table"
                                                    placeholder="Enter reward"
                                                    value={missionRewards[`mission_${missionIndex}`] ? 
                                                        missionRewards[`mission_${missionIndex}`].replace(/\B(?=(\d{3})+(?!\d))/g, ',') : 
                                                        ''}
                                                    onChange={(e) => handleRewardChange(`mission_${missionIndex}`, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="currency-label">aUEC</span>
                                            </div>
                                            <span className="collapse-arrow">{collapsedMissions[missionIndex] ? '▲' : '▼'}</span>
                                        </div>
                                    </div>
                                    {!collapsedMissions[missionIndex] && (
                                        <table className="hauling-mission-table">
                                            <thead>
                                                <tr>
                                                    <th>Drop off points</th>
                                                    <th>Commodity</th>
                                                    <th style={{ width: `${Math.max(50, ...missionEntries[missionIndex]?.map(entry => entry.currentAmount.length * 8) || [50])}px` }}>QTY</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {missionEntries[missionIndex]?.map((entry, index) => (
                                                    <tr key={index}>
                                                        <td>{entry.dropOffPoint}</td>
                                                        <td>{entry.commodity}</td>
                                                        <td style={{ width: `${Math.max(50, entry.currentAmount.length * 8)}px` }}>
                                                            {formatAmount(entry.currentAmount, entry.originalAmount)}
                                                        </td>
                                                        <td className="status">
                                                            <span 
                                                                onClick={() => {
                                                                    const newStatus = entry.status === 'Pending' ? 'Delivered' : 'Pending';
                                                                    setEntries(prevEntries => {
                                                                        const updatedEntries = [...prevEntries];
                                                                        const entryIndex = updatedEntries.findIndex(e => e.id === entry.id);
                                                                        if (entryIndex !== -1) {
                                                                            updatedEntries[entryIndex].status = newStatus;
                                                                        }
                                                                        return updatedEntries;
                                                                    });

                                                                    setMissionEntries(prevMissionEntries => {
                                                                        const updatedMissionEntries = [...prevMissionEntries];
                                                                        updatedMissionEntries.forEach((mission, missionIndex) => {
                                                                            if (mission) {
                                                                                const missionEntryIndex = mission.findIndex(e => e.id === entry.id);
                                                                                if (missionEntryIndex !== -1) {
                                                                                    updatedMissionEntries[missionIndex][missionEntryIndex].status = newStatus;
                                                                                }
                                                                            }
                                                                        });
                                                                        return updatedMissionEntries;
                                                                    });
                                                                }}
                                                                style={{ 
                                                                    cursor: 'pointer',
                                                                    color: entry.status === 'Delivered' ? 'green' : 'inherit',
                                                                    textDecoration: entry.status === 'Delivered' ? 'underline' : 'none'
                                                                }}
                                                            >
                                                                {entry.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            );
                        });
                    })()
                ) : (
                    // Manifest View
                    Object.keys(entries.reduce((acc, entry) => {
                        acc[entry.dropOffPoint] = true;
                        return acc;
                    }, {})).map(dropOffPoint => (
                        <div key={dropOffPoint}>
                            <div className="drop-off-header" onClick={() => toggleCollapse(dropOffPoint)}>
                                <div className="left-box">
                                    <div className="sort-buttons">
                                        <button 
                                            className="sort-button" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveDropOffPoint(dropOffPoint, -1);
                                            }}
                                        >
                                            ▲
                                        </button>
                                        <button 
                                            className="sort-button" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveDropOffPoint(dropOffPoint, 1);
                                            }}
                                        >
                                            ▼
                                        </button>
                                    </div>
                                    <span>{dropOffPoint}</span>
                                    <span style={{ fontSize: 'small', marginLeft: '10px' }}>
                                        ({entries.find(entry => entry.dropOffPoint === dropOffPoint)?.planet} - {entries.find(entry => entry.dropOffPoint === dropOffPoint)?.moon})
                                    </span>
                                </div>
                                <div className="right-box">
                                    <span>{collapsed[dropOffPoint] ? '▲' : '▼'}</span>
                                    <button onClick={(e) => { e.stopPropagation(); markAsDelivered(dropOffPoint, entries.filter(entry => entry.dropOffPoint === dropOffPoint).map(entry => entry.id)); }}>Cargo Delivered</button>
                                </div>
                            </div>
                            {!collapsed[dropOffPoint] && (
                                <table className="hauling-manifest-table">
                                    <thead>
                                        <tr>
                                            <th className="pickup">Pickup</th>
                                            <th className="commodity">Commodity</th>
                                            <th className="amount" style={{ 
                                                width: `${Math.max(50, ...entries
                                                    .filter(entry => entry.dropOffPoint === dropOffPoint)
                                                    .map(entry => {
                                                        // Handle both amount and currentAmount
                                                        const value = entry.currentAmount || entry.amount || '';
                                                        return value.toString().length * 8;
                                                    })
                                                )}px`
                                            }}>QTY</th>
                                            <th className="actions">Actions</th>
                                            <th className="status">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.filter(entry => entry.dropOffPoint === dropOffPoint).map((entry, index) => {
                                            // Calculate the absolute index in the entries array
                                            const absoluteIndex = entries.findIndex(e => e.id === entry.id);
                                            
                                            return (
                                            <tr key={index}>
                                                <td className="pickup">{entry.pickup}</td>
                                                <td className="commodity">{entry.commodity}</td>
                                                <td className="amount">
                                                    {formatAmount(entry.currentAmount, entry.originalAmount)}
                                                </td>
                                                <td className="actions">
                                                    <input
                                                        type="text"
                                                        defaultValue={entry.currentAmount}
                                                        size="10"
                                                        onChange={(e) => {
                                                            updateCargo(absoluteIndex, e.target.value);
                                                        }}
                                                        onKeyPress={(e) => handleAmountKeyPress(e, absoluteIndex)}
                                                    />
                                                    <button onClick={() => updateCargo(absoluteIndex, entry.currentAmount)}>Update Cargo</button>
                                                    <button className="remove-cargo-button" onClick={() => removeCargo(absoluteIndex)}>Remove Cargo</button>
                                                </td>
                                                <td className="status">
                                                    <span 
                                                        onClick={() => {
                                                            const newStatus = entry.status === 'Pending' ? 'Delivered' : 'Pending';
                                                            setEntries(prevEntries => {
                                                                const updatedEntries = [...prevEntries];
                                                                const entryIndex = updatedEntries.findIndex(e => e.id === entry.id);
                                                                if (entryIndex !== -1) {
                                                                    updatedEntries[entryIndex].status = newStatus;
                                                                }
                                                                return updatedEntries;
                                                            });

                                                            setMissionEntries(prevMissionEntries => {
                                                                const updatedMissionEntries = [...prevMissionEntries];
                                                                updatedMissionEntries.forEach((mission, missionIndex) => {
                                                                    if (mission) {
                                                                        const missionEntryIndex = mission.findIndex(e => e.id === entry.id);
                                                                        if (missionEntryIndex !== -1) {
                                                                            updatedMissionEntries[missionIndex][missionEntryIndex].status = newStatus;
                                                                        }
                                                                    }
                                                                });
                                                                return updatedMissionEntries;
                                                            });
                                                        }}
                                                        style={{ 
                                                            cursor: 'pointer',
                                                            color: entry.status === 'Delivered' ? 'green' : 'inherit',
                                                            textDecoration: entry.status === 'Delivered' ? 'underline' : 'none'
                                                        }}
                                                    >
                                                        {entry.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );})}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))
                )}
            </div>

        </div>
    );
};