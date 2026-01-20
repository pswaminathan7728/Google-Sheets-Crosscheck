

// ============ CONFIGURATION ============
const PAIR_SCRIPTS = [
  {
    name: 'SF vs SF',
    scriptId: 'SCRIPT_ID_1', // Apps Script ID for SF pair
    functionName: 'runPairCheck'
  },
  {
    name: 'Sacramento vs Sacramento',
    scriptId: 'SCRIPT_ID_2', // Apps Script ID for Sacramento pair
    functionName: 'runPairCheck'
  },
  {
    name: 'Vegas vs Vegas',
    scriptId: 'SCRIPT_ID_3', // Apps Script ID for Vegas pair
    functionName: 'runPairCheck'
  }
  // Add more pairs as needed
];

// ============ MENU ============
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Master Cross-Check')
    .addItem('Run All Cross-Checks', 'runAllCrossChecks')
    .addItem('Run Individual Tests', 'runIndividualTests')
    .addToUi();
}

// ============ MAIN FUNCTION ============
function runAllCrossChecks() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Starting', 'Running all cross-check pairs...', ui.ButtonSet.OK);
  
  const results = [];
  let totalMatches = 0;
  
  // Trigger all scripts simultaneously
  for (const script of PAIR_SCRIPTS) {
    try {
      const result = triggerRemoteScript(script.scriptId, script.functionName);
      results.push({
        pairName: script.name,
        matches: result ? result.matches : 0,
        status: 'success'
      });
      if (result) totalMatches += result.matches;
    } catch (error) {
      Logger.log(`Error running ${script.name}: ${error}`);
      results.push({
        pairName: script.name,
        matches: 0,
        status: 'error',
        error: error.toString()
      });
    }
  }
  
  // Show summary
  let summary = `Cross-check complete!\n\nResults:\n`;
  results.forEach(result => {
    summary += `${result.pairName}: ${result.matches} matches\n`;
  });
  summary += `\nTotal: ${totalMatches} matches found`;
  
  ui.alert('Complete', summary, ui.ButtonSet.OK);
  
  // Send summary email
  sendMasterSummary(results, totalMatches);
}

// ============ SCRIPT EXECUTION ============
function triggerRemoteScript(scriptId, functionName) {
  try {
    // Use UrlFetch to trigger remote Apps Script
    const url = `https://script.googleapis.com/v1/scripts/${scriptId}:run`;
    
    const payload = {
      'function': functionName,
      'devMode': false
    };
    
    const options = {
      'method': 'POST',
      'headers': {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.error) {
      throw new Error(responseData.error.message);
    }
    
    return responseData.response.result;
    
  } catch (error) {
    Logger.log(`Error triggering script ${scriptId}: ${error}`);
    throw error;
  }
}

// ============ ALTERNATIVE: LOCAL EXECUTION ============
// If remote execution doesn't work, use this approach instead
function runIndividualTests() {
  // This requires copying the individual functions into this script
  // Then calling them directly
  
  const ui = SpreadsheetApp.getUi();
  ui.alert('Running', 'Testing individual functions...', ui.ButtonSet.OK);
  
  // Example calls (you'd need to implement these)
  // const result1 = runSFCheck();
  // const result2 = runSacramentoCheck();
  // const result3 = runVegasCheck();
  
  ui.alert('Complete', 'Individual tests completed', ui.ButtonSet.OK);
}

// ============ EMAIL SUMMARY ============
function sendMasterSummary(results, totalMatches) {
  const recipients = ['admin@example.com']; // Your email
  const subject = `[MASTER ALERT] ${totalMatches} Total Matches Found Across All Pairs`;
  
  let body = `Master cross-check completed with ${totalMatches} total matches:\n\n`;
  
  results.forEach(result => {
    body += `${result.pairName}: ${result.matches} matches`;
    if (result.status === 'error') {
      body += ` (ERROR: ${result.error})`;
    }
    body += '\n';
  });
  
  if (totalMatches > 0) {
    MailApp.sendEmail(recipients.join(','), subject, body);
  }
}
