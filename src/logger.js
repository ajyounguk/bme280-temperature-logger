const createLog = ( logLevel, logText) => {
    console.log ("<" + logLevel + "> [" + new Date().toISOString() + "] - " + logText)

    if (logLevel == "ERROR" || logLevel == "FATAL") {
        process.exit(1);
    }
        
  };

module.exports = { createLog };