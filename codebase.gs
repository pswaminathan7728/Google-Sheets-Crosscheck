/**
 * Cross-Check Registration System
 * Modular system to compare data across two Google Sheets with different structures
 */

// ============= CONFIGURATION =============
/**
 * Configuration object - Update this to match your sheets and comparison needs
 * This is the only part you need to modify when sheet structures change
 */
const CONFIG = {
  // Email notification settings
  notifications: {
    enabled: true,
    recipientEmail: 'pranbro13@gmail.com', // CHANGE THIS to your email
    sendOnlyIfMatchesFound: true
  },
  sheets: {
    program1: {
      spreadsheetId: '1zL1B4oQalFgBs3E3ybIRPe6_Pie0frBDbzs0mSfFHgo', // Replace with actual ID
      sheetName: 'Sheet1',
      // Map friendly names to actual column headers in this sheet
      columnMapping: {
        'email': '1',
        'firstName': '2',
        'lastName': '3',
        'phone': '4',
        'dateOfBirth': '5',
        'socialId': '6' // Example: last 4 digits of SSN
      }
    },
    program2: {
      spreadsheetId: '1cL-KvJnmKJlMjsfivXYUg0f46JrXzb6ulCLUJUIhZ3w', // Replace with actual ID
      sheetName: 'Sheet1',
      // Map friendly names to actual column headers in this sheet
      columnMapping: {
        'email': '1',
        'firstName': '2',
        'lastName': '3',
        'phone': '4',
        'dateOfBirth': '5',
        'socialId': '6'
      }
    }
  },
  // Define which fields to use for matching
  matchingRules: {
    // Primary matching (strong indicators of same person)
    primary: ['email', 'socialId'],
    // Secondary matching (additional verification)
    secondary: ['firstName', 'lastName', 'dateOfBirth'],
    // Minimum number of secondary matches required if no primary match
    minSecondaryMatches: 2
  },
  // Fields to compare for data consistency
  comparisonFields: ['email', 'firstName', 'lastName', 'phone', 'dateOfBirth', 'socialId']
};

// ============= MAIN FUNCTIONS =============

/**
 * Main function to run the cross-check
 * Can be triggered manually or via time-based trigger
 */
function runCrossCheck() {
  try {
    Logger.log('Starting cross-check process...');
    
    // Load data from both sheets
    const program1Data = loadSheetData(CONFIG.sheets.program1);
    const program2Data = loadSheetData(CONFIG.sheets.program2);
    
    Logger.log(`Loaded ${program1Data.length} records from Program 1`);
    Logger.log(`Loaded ${program2Data.length} records from Program 2`);
    
    // Find matches
    const matches = findMatches(program1Data, program2Data);
    
    // Generate report
    const report = generateReport(matches);
    
    // Output results (you can modify this to write to a sheet, send email, etc.)
    outputResults(report);
    
    Logger.log('Cross-check completed successfully');
    return report;
    
  } catch (error) {
    Logger.log(`Error in runCrossCheck: ${error.toString()}`);
    throw error;
  }
}

/**
 * Load data from a sheet with dynamic column mapping
 */
function loadSheetData(sheetConfig) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetConfig.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetConfig.sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetConfig.sheetName}" not found`);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return []; // No data rows
    }
    
    const headers = data[0];
    const columnIndexMap = createColumnIndexMap(headers, sheetConfig.columnMapping);
    
    // Convert rows to objects using mapped columns
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Skip empty rows
      if (row.every(cell => !cell || cell === '')) continue;
      
      const record = {
        rowNumber: i + 1, // Store original row number for reference
        originalData: {} // Store all mapped data
      };
      
      // Map data using configuration
      for (const [fieldName, columnHeader] of Object.entries(sheetConfig.columnMapping)) {
        const columnIndex = columnIndexMap[fieldName];
        if (columnIndex !== undefined) {
          record.originalData[fieldName] = normalizeValue(row[columnIndex]);
        }
      }
      
      records.push(record);
    }
    
    return records;
    
  } catch (error) {
    Logger.log(`Error loading sheet data: ${error.toString()}`);
    throw error;
  }
}

/**
 * Create a map of field names to column indices
 */
function createColumnIndexMap(headers, columnMapping) {
  const indexMap = {};
  
  for (const [fieldName, columnHeader] of Object.entries(columnMapping)) {
    const index = headers.findIndex(h => 
      h.toString().trim().toLowerCase() === columnHeader.toLowerCase()
    );
    
    if (index !== -1) {
      indexMap[fieldName] = index;
    } else {
      Logger.log(`Warning: Column "${columnHeader}" not found for field "${fieldName}"`);
    }
  }
  
  return indexMap;
}

/**
 * Normalize values for comparison (trim, lowercase, etc.)
 */
function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  
  // Handle dates
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  
  // Convert to string and normalize
  return value.toString().trim().toLowerCase();
}

/**
 * Find matches between two datasets
 */
function findMatches(data1, data2) {
  const matches = [];
  
  for (const record1 of data1) {
    for (const record2 of data2) {
      const matchScore = calculateMatchScore(record1, record2);
      
      if (matchScore.isMatch) {
        matches.push({
          program1Record: record1,
          program2Record: record2,
          matchScore: matchScore,
          conflicts: findConflicts(record1, record2)
        });
      }
    }
  }
  
  return matches;
}

/**
 * Calculate match score between two records
 */
function calculateMatchScore(record1, record2) {
  const score = {
    primaryMatches: [],
    secondaryMatches: [],
    isMatch: false,
    confidence: 'none'
  };
  
  // Check primary matching fields
  for (const field of CONFIG.matchingRules.primary) {
    if (record1.originalData[field] && record2.originalData[field]) {
      if (record1.originalData[field] === record2.originalData[field]) {
        score.primaryMatches.push(field);
      }
    }
  }
  
  // Check secondary matching fields
  for (const field of CONFIG.matchingRules.secondary) {
    if (record1.originalData[field] && record2.originalData[field]) {
      if (record1.originalData[field] === record2.originalData[field]) {
        score.secondaryMatches.push(field);
      }
    }
  }
  
  // Determine if it's a match
  if (score.primaryMatches.length > 0) {
    score.isMatch = true;
    score.confidence = 'high';
  } else if (score.secondaryMatches.length >= CONFIG.matchingRules.minSecondaryMatches) {
    score.isMatch = true;
    score.confidence = 'medium';
  }
  
  return score;
}

/**
 * Find data conflicts between matched records
 */
function findConflicts(record1, record2) {
  const conflicts = [];
  
  for (const field of CONFIG.comparisonFields) {
    const value1 = record1.originalData[field] || '';
    const value2 = record2.originalData[field] || '';
    
    if (value1 && value2 && value1 !== value2) {
      conflicts.push({
        field: field,
        program1Value: value1,
        program2Value: value2
      });
    }
  }
  
  return conflicts;
}

/**
 * Generate a report from matches
 */
function generateReport(matches) {
  const report = {
    timestamp: new Date(),
    summary: {
      totalMatches: matches.length,
      highConfidenceMatches: matches.filter(m => m.matchScore.confidence === 'high').length,
      mediumConfidenceMatches: matches.filter(m => m.matchScore.confidence === 'medium').length,
      recordsWithConflicts: matches.filter(m => m.conflicts.length > 0).length
    },
    matches: matches.map(match => ({
      program1Row: match.program1Record.rowNumber,
      program2Row: match.program2Record.rowNumber,
      confidence: match.matchScore.confidence,
      matchedOn: {
        primary: match.matchScore.primaryMatches,
        secondary: match.matchScore.secondaryMatches
      },
      person: {
        email: match.program1Record.originalData.email || match.program2Record.originalData.email,
        name: `${match.program1Record.originalData.firstName || ''} ${match.program1Record.originalData.lastName || ''}`.trim()
      },
      conflicts: match.conflicts
    }))
  };
  
  return report;
}

/**
 * Output results (customize based on your needs)
 */
function outputResults(report) {
  // Log to console
  Logger.log('=== CROSS-CHECK REPORT ===');
  Logger.log(`Timestamp: ${report.timestamp}`);
  Logger.log(`Total Matches Found: ${report.summary.totalMatches}`);
  
  // Filter for only perfect matches (no conflicts)
  const perfectMatches = report.matches.filter(match => 
    match.conflicts && match.conflicts.length === 0
  );
  
  // Send email notification if enabled and perfect matches found
  if (CONFIG.notifications.enabled && perfectMatches.length > 0) {
    sendPerfectMatchNotificationEmail(report, perfectMatches);
  }
  
  Logger.log(`Perfect matches (no conflicts): ${perfectMatches.length}`);
  Logger.log(`Matches with conflicts: ${report.matches.filter(m => m.conflicts && m.conflicts.length > 0).length}`);
}

/**
 * Send email notification only for perfect matches (all data points match)
 */
function sendPerfectMatchNotificationEmail(report, perfectMatches) {
  try {
    const recipient = CONFIG.notifications.recipientEmail;
    const subject = `[ALERT] Registration Cross-Check: ${perfectMatches.length} Perfect Match(es) Found`;
    
    let body = `Registration cross-check detected ${perfectMatches.length} perfect match(es) where ALL data points match exactly.\n\n`;
    
    body += 'PERFECT MATCHES FOUND:\n';
    body += '=======================\n\n';
    
    perfectMatches.forEach((match, index) => {
      body += `Perfect Match ${index + 1}:\n`;
      body += `- Sheet 1 Row: ${match.program1Row}\n`;
      body += `- Sheet 2 Row: ${match.program2Row}\n`;
      body += `- Person: ${match.person.name} (${match.person.email})\n`;
      body += `- All data points match exactly\n`;
      body += '\n';
    });
    
    body += '\nThese individuals are registered in both programs with identical information.';
    body += '\nImmediate review recommended.';
    
    body += `\n\nChecked at: ${report.timestamp}`;
    
    // Add note if there were other matches with conflicts - check if conflicts array exists
    const conflictMatches = report.matches.filter(m => m.conflicts && m.conflicts.length > 0).length;
    if (conflictMatches > 0) {
      body += `\n\nNote: ${conflictMatches} additional potential match(es) were found with conflicting data points (not included in this alert).`;
    }
    
    MailApp.sendEmail(recipient, subject, body);
    Logger.log(`Email notification sent to ${recipient} for ${perfectMatches.length} perfect matches`);
    
  } catch (error) {
    Logger.log(`Error sending email: ${error.toString()}`);
  }
}

/**
 * Write report to a Google Sheet
 */
function writeReportToSheet(report) {
  const spreadsheet = SpreadsheetApp.create(`Cross-Check Report ${Utilities.formatDate(report.timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
  const sheet = spreadsheet.getActiveSheet();
  
  // Write headers
  const headers = [
    'Match #', 'Confidence', 'Person Name', 'Email', 
    'Program 1 Row', 'Program 2 Row', 'Matched Fields', 'Conflicts'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Write data
  const rows = report.matches.map((match, index) => [
    index + 1,
    match.confidence,
    match.person.name,
    match.person.email,
    match.program1Row,
    match.program2Row,
    `Primary: ${match.matchedOn.primary.join(', ')}\nSecondary: ${match.matchedOn.secondary.join(', ')}`,
    match.conflicts.map(c => `${c.field}: "${c.program1Value}" vs "${c.program2Value}"`).join('\n')
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // Format
  sheet.autoResizeColumns(1, headers.length);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  Logger.log(`Report written to: ${spreadsheet.getUrl()}`);
}

/**
 * Send email report
 */
function sendEmailReport(report) {
  const recipient = Session.getActiveUser().getEmail();
  const subject = `Cross-Check Report - ${report.summary.totalMatches} Matches Found`;
  
  let body = `
Cross-Check Registration Report
Generated: ${report.timestamp}

SUMMARY:
- Total Matches: ${report.summary.totalMatches}
- High Confidence: ${report.summary.highConfidenceMatches}
- Medium Confidence: ${report.summary.mediumConfidenceMatches}
- Records with Conflicts: ${report.summary.recordsWithConflicts}

DETAILED MATCHES:
`;
  
  report.matches.forEach((match, index) => {
    body += `
${index + 1}. ${match.person.name} (${match.person.email})
   Confidence: ${match.confidence}
   Rows: Program 1 #${match.program1Row}, Program 2 #${match.program2Row}
`;
    if (match.conflicts.length > 0) {
      body += '   Conflicts:\n';
      match.conflicts.forEach(c => {
        body += `     - ${c.field}: "${c.program1Value}" vs "${c.program2Value}"\n`;
      });
    }
  });
  
  MailApp.sendEmail(recipient, subject, body);
  Logger.log(`Email report sent to ${recipient}`);
}

// ============= MENU SETUP =============

/**
 * Create custom menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Cross-Check System')
    .addItem('Run Cross-Check', 'runCrossCheck')
    .addItem('Setup Time Trigger', 'setupTimeTrigger')
    .addItem('Remove Time Trigger', 'removeTimeTrigger')
    .addSeparator()
    .addItem('Test Connection', 'testConnection')
    .addToUi();
}

/**
 * Setup automatic time-based trigger
 */
function setupTimeTrigger() {
  ScriptApp.newTrigger('runCrossCheck')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  
  SpreadsheetApp.getUi().alert('Daily trigger set for 8 AM');
}

/**
 * Remove time-based triggers
 */
function removeTimeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runCrossCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  SpreadsheetApp.getUi().alert('Time triggers removed');
}

/**
 * Test connection to both sheets
 */
function testConnection() {
  try {
    const sheet1 = SpreadsheetApp.openById(CONFIG.sheets.program1.spreadsheetId);
    const sheet2 = SpreadsheetApp.openById(CONFIG.sheets.program2.spreadsheetId);
    
    SpreadsheetApp.getUi().alert(
      'Connection Successful',
      `Connected to:\n- ${sheet1.getName()}\n- ${sheet2.getName()}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Connection Failed',
      `Error: ${error.toString()}\n\nPlease check the spreadsheet IDs in CONFIG.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
