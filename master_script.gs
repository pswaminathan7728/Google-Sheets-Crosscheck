
// Configuration
const SIGNAL_CONFIG = {
  spreadsheetId: 'YOUR_SHARED_SPREADSHEET_ID', // One shared sheet all scripts watch
  signalCell: 'AAA1000', // Cell AAA1000 (far away from normal data)
  signalValues: ['TRIGGER', 'IDLE'] // Alternates between these
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔍 Cross-Check Master')
    .addItem('Run All Cross-Checks', 'triggerAllScripts')
    .addItem('Check Signal Status', 'checkSignalStatus')
    .addToUi();
}

function triggerAllScripts() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Triggering', 'Sending signal to all scripts...', ui.ButtonSet.OK);
  
  try {
    const ss = SpreadsheetApp.openById(SIGNAL_CONFIG.spreadsheetId);
    const sheet = ss.getActiveSheet();
    
    // Get current signal value
    const currentValue = sheet.getRange(SIGNAL_CONFIG.signalCell).getValue();
    
    // Toggle the signal (this triggers all watching scripts)
    const newValue = currentValue === SIGNAL_CONFIG.signalValues[0] ? 
      SIGNAL_CONFIG.signalValues[1] : SIGNAL_CONFIG.signalValues[0];
    
    sheet.getRange(SIGNAL_CONFIG.signalCell).setValue(newValue);
    
    Logger.log(`Signal sent: Changed ${SIGNAL_CONFIG.signalCell} to "${newValue}"`);
    
    ui.alert('Complete', `Signal sent! All scripts should be running.\nSignal: ${newValue}`, ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('Error', `Failed to send signal: ${error.toString()}`, ui.ButtonSet.OK);
  }
}

function checkSignalStatus() {
  try {
    const ss = SpreadsheetApp.openById(SIGNAL_CONFIG.spreadsheetId);
    const sheet = ss.getActiveSheet();
    const currentValue = sheet.getRange(SIGNAL_CONFIG.signalCell).getValue();
    
    SpreadsheetApp.getUi().alert('Signal Status', `Current signal value: "${currentValue}"`, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error', `Could not read signal: ${error.toString()}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
