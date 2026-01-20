
// Configuration - UPDATE FOR EACH PAIR
const CONFIG = {
  notifications: {
    enabled: true,
    recipientEmails: ['admin@example.com', 'manager@example.com'], // CHANGE THESE
    sendOnlyIfMatchesFound: true
  },
  
  // Signal watching config (SAME FOR ALL SCRIPTS)
  signal: {
    spreadsheetId: 'YOUR_SHARED_SPREADSHEET_ID', // Same as master - CHANGE THIS
    signalCell: 'AAA1000' // Same as master
  },
  
  // Pair-specific config (DIFFERENT FOR EACH SCRIPT)
  pair: {
    name: 'SF vs SF', // CHANGE THIS: 'Sacramento vs Sacramento', 'Vegas vs Vegas', etc.
    program1: {
      spreadsheetId: 'YOUR_PROGRAM1_SHEET_ID', // CHANGE THIS
      tabName: 'San Francisco', // CHANGE THIS FOR EACH PAIR
      columnMapping: {
        'firstName': 'first',
        'lastName': 'last',
        'address': 'address',
        'phone': 'phone'
      }
    },
    program2: {
      spreadsheetId: 'YOUR_PROGRAM2_SHEET_ID', // CHANGE THIS
      tabName: 'San Francisco', // CHANGE THIS FOR EACH PAIR
      columnMapping: {
        'firstName': 'first',
        'lastName': 'last',
        'address': 'address',
        'phone': 'phone'
      }
    }
  },
  
  matchingRules: {
    primary: ['phone'],
    secondary: ['firstName', 'lastName', 'address'],
    minSecondaryMatches: 2
  }
};

// ============ SETUP AND MENU ============
function onOpen() {
  setupSignalTrigger();
  
  SpreadsheetApp.getUi()
    .createMenu('🔍 ' + CONFIG.pair.name)
    .addItem('Run Manual Check', 'runPairCheck')
    .addItem('Test Signal', 'testSignal')
    .addToUi();
}

function setupSignalTrigger() {
  try {
    // Remove old triggers
    ScriptApp.getProjectTriggers().forEach(trigger => {
      if (trigger.getHandlerFunction() === 'onEdit') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new trigger for the signal sheet
    ScriptApp.newTrigger('onEdit')
      .onEdit()
      .create();
    
    Logger.log('Signal trigger setup complete');
    
  } catch (error) {
    Logger.log('Error setting up trigger: ' + error.toString());
  }
}

// ============ SIGNAL DETECTION ============
function onEdit(e) {
  try {
    // Check if edit was in our signal sheet
    const editedSheetId = e.source.getId();
    if (editedSheetId !== CONFIG.signal.spreadsheetId) {
      return; // Not our signal sheet, ignore
    }
    
    // Check if the specific signal cell was changed
    const range = e.range;
    const changedCell = range.getA1Notation();
    
    if (changedCell === CONFIG.signal.signalCell) {
      Logger.log(`SIGNAL DETECTED in ${CONFIG.pair.name}!`);
      runPairCheck();
    }
    
  } catch (error) {
    Logger.log('Error in signal handler: ' + error.toString());
  }
}

function testSignal() {
  Logger.log('Testing signal for ' + CONFIG.pair.name);
  runPairCheck();
  SpreadsheetApp.getUi().alert('Test complete for ' + CONFIG.pair.name);
}

// ============ MAIN PAIR CHECK FUNCTION ============
function runPairCheck() {
  try {
    Logger.log('Starting pair check: ' + CONFIG.pair.name);
    
    const data1 = loadSheetData(CONFIG.pair.program1);
    const data2 = loadSheetData(CONFIG.pair.program2);
    
    Logger.log(`Loaded ${data1.length} records from Program 1, ${data2.length} from Program 2`);
    
    const matches = findMatches(data1, data2);
    
    Logger.log(`${CONFIG.pair.name}: Found ${matches.length} matches`);
    
    if (matches.length > 0 && CONFIG.notifications.enabled) {
      sendPairNotification(matches);
    }
    
    return { pairName: CONFIG.pair.name, matches: matches.length };
    
  } catch (error) {
    Logger.log('Error in pair check: ' + error.toString());
    throw error;
  }
}

// ============ DATA LOADING ============
function loadSheetData(sheetConfig) {
  const ss = SpreadsheetApp.openById(sheetConfig.spreadsheetId);
  const sheet = ss.getSheetByName(sheetConfig.tabName);
  
  if (!sheet) {
    throw new Error(`Tab "${sheetConfig.tabName}" not found`);
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const columnMap = createColumnMap(headers, sheetConfig.columnMapping);
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(cell => !cell)) continue;
    
    const record = {
      rowNumber: i + 1,
      data: {}
    };
    
    for (const [field, colIndex] of Object.entries(columnMap)) {
      if (colIndex !== -1) {
        record.data[field] = normalizeField(row[colIndex], field);
      }
    }
    
    records.push(record);
  }
  
  return records;
}

// ============ UTILITY FUNCTIONS ============
function createColumnMap(headers, mappingConfig) {
  const map = {};
  for (const [field, phrase] of Object.entries(mappingConfig)) {
    const index = findColumnIndex(headers, phrase);
    if (index !== -1) {
      map[field] = index;
    } else {
      Logger.log(`Warning: Column not found for "${phrase}"`);
    }
  }
  return map;
}

function findColumnIndex(headers, searchPhrase) {
  const lowerPhrase = searchPhrase.toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().toLowerCase();
    if (header.includes(lowerPhrase)) return i;
  }
  return -1;
}

function normalizeField(value, fieldName) {
  if (!value) return '';
  let normalized = value.toString().trim();
  
  if (fieldName === 'address') return standardizeAddress(normalized);
  if (fieldName === 'phone') return normalized.replace(/\D/g, '');
  return normalized.toLowerCase();
}

function standardizeAddress(address) {
  if (!address) return '';
  
  const streetTypes = {
    'street': ['st', 'st.', 'str', 'str.', 'street'],
    'avenue': ['ave', 'ave.', 'avenue'],
    'road': ['rd', 'rd.', 'road'],
    'drive': ['dr', 'dr.', 'drive'],
    'court': ['ct', 'ct.', 'court'],
    'place': ['pl', 'pl.', 'place'],
    'lane': ['ln', 'ln.', 'lane']
  };
  
  let cleaned = address.toString().toLowerCase().trim().replace(/\s+/g, ' ');
  
  for (const [standard, variations] of Object.entries(streetTypes)) {
    for (const variation of variations) {
      const regex = new RegExp('\\b' + variation + '\\b', 'gi');
      cleaned = cleaned.replace(regex, standard);
    }
  }
  
  return cleaned;
}

// ============ MATCHING ENGINE ============
function findMatches(data1, data2) {
  const matches = [];
  
  // Create phone index for fast lookup
  const phoneIndex = {};
  for (const record of data2) {
    const phone = record.data.phone;
    if (phone) {
      if (!phoneIndex[phone]) phoneIndex[phone] = [];
      phoneIndex[phone].push(record);
    }
  }
  
  for (const record1 of data1) {
    const phone1 = record1.data.phone;
    
    // Check phone matches first (fast)
    if (phone1 && phoneIndex[phone1]) {
      for (const record2 of phoneIndex[phone1]) {
        matches.push({ record1, record2, matchType: 'phone' });
      }
    } else {
      // Check name/address matches for records without phone
      for (const record2 of data2) {
        if (record2.data.phone) continue; // Skip if has phone
        
        let matchCount = 0;
        for (const field of CONFIG.matchingRules.secondary) {
          if (record1.data[field] && record2.data[field] && 
              record1.data[field] === record2.data[field]) {
            matchCount++;
          }
        }
        
        if (matchCount >= CONFIG.matchingRules.minSecondaryMatches) {
          matches.push({ record1, record2, matchType: 'name' });
        }
      }
    }
  }
  
  return matches;
}

// ============ EMAIL NOTIFICATION ============
function sendPairNotification(matches) {
  const recipients = CONFIG.notifications.recipientEmails.join(',');
  const subject = `[ALERT] ${matches.length} Match(es) in ${CONFIG.pair.name}`;
  
  let body = `Cross-check found ${matches.length} match(es) in ${CONFIG.pair.name}:\n\n`;
  
  matches.forEach((match, i) => {
    body += `Match ${i+1}:\n`;
    body += `- Program 1 Row: ${match.record1.rowNumber}\n`;
    body += `- Program 2 Row: ${match.record2.rowNumber}\n`;
    body += `- Name: ${match.record1.data.firstName} ${match.record1.data.lastName}\n`;
    body += `- Phone: ${match.record1.data.phone}\n`;
    body += `- Address: ${match.record1.data.address}\n\n`;
  });
  
  MailApp.sendEmail(recipients, subject, body);
  Logger.log('Email sent for ' + CONFIG.pair.name);
}
