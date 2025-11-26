const CONFIG = {
  notifications: {
    enabled: true,
    recipientEmails: ['example@gmail.com', 'example@gmail.com'], // Multiple emails
    sendOnlyIfMatchesFound: true
  },
  sheets: {
    program1: {
      spreadsheetId: 'enter in sheet id here',
      tabName: 'enter in tab name here',
      columnMapping: {
        'firstName': 'enter in identifying phrase here',      
        'lastName': 'enter in identifying phrase here',         
        'address': 'enter in identifying phrase here',
        'phone': 'enter in identifying phrase here'
      }
    },
    program2: {
      spreadsheetId: 'enter in sheet id here',
      tabName: 'enter in tab name here',
      columnMapping: {
        'firstName': 'enter in identifying phrase here',
        'lastName': 'enter in identifying phrase here',
        'address': 'enter in identifying phrase here',
        'phone': 'enter in identifying phrase here'
      }
    }
  },
  matchingRules: {
    primary: ['phone'],
    secondary: ['firstName', 'lastName', 'address'],
    minSecondaryMatches: 2
  },
  colors: {
    nameMatch: '#ffff00',      // yellow
    contactMatch: '#ff9900'    // orange
  }
};

function findColumnIndex(headers, searchPhrase) {
  const lowerPhrase = searchPhrase.toLowerCase();
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().toLowerCase();
    if (header.includes(lowerPhrase)) {
      return i;
    }
  }
  
  return -1;
}

function createColumnMap(headers, mappingConfig) {
  const map = {};
  
  for (const [field, phrase] of Object.entries(mappingConfig)) {
    const index = findColumnIndex(headers, phrase);
    if (index !== -1) {
      map[field] = index;
      Logger.log(`Found "${field}" in column ${index} using phrase "${phrase}"`);
    } else {
      Logger.log(`Warning: No column found for "${phrase}"`);
    }
  }
  
  return map;
}

function normalizeField(value, fieldName) {
  if (!value) return '';
  
  let normalized = value.toString().trim();
  
  // Address normalization
  if (fieldName === 'address') {
    normalized = normalized.toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()) // Title case
      .replace(/\bSt\b/g, 'Street')
      .replace(/\bAve\b/g, 'Avenue')
      .replace(/\bDr\b/g, 'Drive')
      .replace(/\bRd\b/g, 'Road');
    return normalized;
  }
  
  // Phone normalization
  if (fieldName === 'phone') {
    return normalized.replace(/\D/g, ''); // Just digits
  }
  
  // Names and default - lowercase for comparison
  return normalized.toLowerCase();
}

function loadSheetData(sheetConfig) {
  const ss = SpreadsheetApp.openById(sheetConfig.spreadsheetId);
  const sheet = ss.getSheetByName(sheetConfig.tabName);
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
      sheetId: sheetConfig.spreadsheetId,
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

function loadSingleRow(sheetConfig, rowNumber) {
  const ss = SpreadsheetApp.openById(sheetConfig.spreadsheetId);
  const sheet = ss.getSheetByName(sheetConfig.tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const columnMap = createColumnMap(headers, sheetConfig.columnMapping);
  
  const record = {
    rowNumber: rowNumber,
    sheetId: sheetConfig.spreadsheetId,
    data: {}
  };
  
  for (const [field, colIndex] of Object.entries(columnMap)) {
    if (colIndex !== -1) {
      record.data[field] = normalizeField(row[colIndex], field);
    }
  }
  
  return record;
}

function calculateMatch(record1, record2) {
  const result = {
    isMatch: false,
    matchType: null,
    primaryMatches: [],
    secondaryMatches: []
  };
  
  // Check primary fields
  for (const field of CONFIG.matchingRules.primary) {
    if (record1.data[field] && record2.data[field] && 
        record1.data[field] === record2.data[field]) {
      result.primaryMatches.push(field);
    }
  }
  
  // Check secondary fields
  for (const field of CONFIG.matchingRules.secondary) {
    if (record1.data[field] && record2.data[field] && 
        record1.data[field] === record2.data[field]) {
      result.secondaryMatches.push(field);
    }
  }
  
  // Determine if it's a match
  if (result.primaryMatches.length > 0) {
    result.isMatch = true;
    result.matchType = result.primaryMatches.includes('phone') || 
                      result.primaryMatches.includes('address') ? 'contact' : 'name';
  } else if (result.secondaryMatches.length >= CONFIG.matchingRules.minSecondaryMatches) {
    result.isMatch = true;
    result.matchType = result.secondaryMatches.includes('phone') || 
                      result.secondaryMatches.includes('address') ? 'contact' : 'name';
  }
  
  return result;
}

function findAllMatches(data1, data2) {
  const matches = [];
  
  for (const record1 of data1) {
    for (const record2 of data2) {
      const match = calculateMatch(record1, record2);
      if (match.isMatch) {
        matches.push({
          record1: record1,
          record2: record2,
          matchInfo: match
        });
      }
    }
  }
  
  return matches;
}

function highlightMatches(matches) {
  const toHighlight = {
    program1: { yellow: new Set(), orange: new Set() },
    program2: { yellow: new Set(), orange: new Set() }
  };
  
  for (const match of matches) {
    const color = match.matchInfo.matchType === 'contact' ? 'orange' : 'yellow';
    
    if (match.record1.sheetId === CONFIG.sheets.program1.spreadsheetId) {
      toHighlight.program1[color].add(match.record1.rowNumber);
    } else {
      toHighlight.program2[color].add(match.record1.rowNumber);
    }
    
    if (match.record2.sheetId === CONFIG.sheets.program2.spreadsheetId) {
      toHighlight.program2[color].add(match.record2.rowNumber);
    } else {
      toHighlight.program1[color].add(match.record2.rowNumber);
    }
  }
  
  applyHighlighting(CONFIG.sheets.program1, toHighlight.program1);
  applyHighlighting(CONFIG.sheets.program2, toHighlight.program2);
}

function applyHighlighting(sheetConfig, colorGroups) {
  const ss = SpreadsheetApp.openById(sheetConfig.spreadsheetId);
  const sheet = ss.getSheetByName(sheetConfig.tabName);
  
  for (const row of colorGroups.yellow) {
    sheet.getRange(row, 1, 1, sheet.getLastColumn())
      .setBackground(CONFIG.colors.nameMatch);
  }
  
  for (const row of colorGroups.orange) {
    sheet.getRange(row, 1, 1, sheet.getLastColumn())
      .setBackground(CONFIG.colors.contactMatch);
  }
}

function sendNotification(matches) {
  Logger.log('sendNotification called with ' + matches.length + ' matches');
  
  if (!CONFIG.notifications.enabled) {
    Logger.log('Notifications disabled');
    return;
  }
  
  if (matches.length === 0) return;
  
  // Check for perfect matches
  const perfectMatches = matches.filter(m => {
    const data1 = m.record1.data;
    const data2 = m.record2.data;
    return Object.keys(data1).every(key => data1[key] === data2[key]);
  });
  
  Logger.log('Found ' + perfectMatches.length + ' perfect matches');
  
  if (perfectMatches.length === 0 && CONFIG.notifications.sendOnlyIfMatchesFound) {
    Logger.log('No perfect matches - not sending email');
    return;
  }
  
  const recipients = CONFIG.notifications.recipientEmails.join(',');
  const subject = `[ALERT] ${perfectMatches.length} Perfect Match(es) Found`;
  
  let body = `Cross-check found ${perfectMatches.length} perfect matches:\n\n`;
  
  perfectMatches.forEach((match, i) => {
    body += `Match ${i+1}:\n`;
    body += `- Sheet 1 Row: ${match.record1.rowNumber}\n`;
    body += `- Sheet 2 Row: ${match.record2.rowNumber}\n`;
    body += `- Name: ${match.record1.data.firstName} ${match.record1.data.lastName}\n`;
    body += `- Phone: ${match.record1.data.phone}\n`;
    body += `- Address: ${match.record1.data.address}\n\n`;
  });
  
  MailApp.sendEmail(recipients, subject, body);
  Logger.log('Email sent');
}

function runFullCheck() {
  const data1 = loadSheetData(CONFIG.sheets.program1);
  const data2 = loadSheetData(CONFIG.sheets.program2);
  
  const matches = findAllMatches(data1, data2);
  
  Logger.log(`Found ${matches.length} matches`);
  
  if (matches.length > 0) {
    highlightMatches(matches);
    sendNotification(matches);
  }
  
  Logger.log(`Check complete: ${matches.length} matches found`);
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const ssId = sheet.getParent().getId();
  
  if (ssId !== CONFIG.sheets.program1.spreadsheetId && 
      ssId !== CONFIG.sheets.program2.spreadsheetId) {
    return;
  }
  
  const rowNumber = range.getRow();
  if (rowNumber <= 1) return;
  
  const editedConfig = ssId === CONFIG.sheets.program1.spreadsheetId ? 
    CONFIG.sheets.program1 : CONFIG.sheets.program2;
  const otherConfig = ssId === CONFIG.sheets.program1.spreadsheetId ? 
    CONFIG.sheets.program2 : CONFIG.sheets.program1;
  
  const editedRecord = loadSingleRow(editedConfig, rowNumber);
  const otherData = loadSheetData(otherConfig);
  
  const matches = [];
  for (const record of otherData) {
    const match = calculateMatch(editedRecord, record);
    if (match.isMatch) {
      matches.push({
        record1: editedRecord,
        record2: record,
        matchInfo: match
      });
    }
  }
  
  if (matches.length > 0) {
    highlightMatches(matches);
    sendNotification(matches);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cross-Check')
    .addItem('Run Full Check', 'runFullCheck')
    .addItem('Clear Highlighting', 'clearHighlights')
    .addToUi();
}

function clearHighlights() {
  [CONFIG.sheets.program1, CONFIG.sheets.program2].forEach(config => {
    const ss = SpreadsheetApp.openById(config.spreadsheetId);
    const sheet = ss.getSheetByName(config.tabName);
    sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn())
      .setBackground(null);
  });
}
