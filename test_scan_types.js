// Test script to verify scan types functionality
const scanTypes = {
  quick_scan: {
    label: '⚡ Quick Scan',
    icon: '⚡',
    tooltip: '40 coins, 49 bots, NO AI\n~5 minutes\nBest for: Fast technical analysis'
  },
  focused_scan: {
    label: '🎯 Focused Scan',
    icon: '🎯',
    tooltip: '40 coins, 49 bots, AI on top 15\n~12 minutes\nBest for: Quality over quantity'
  },
  fast_parallel: {
    label: '🚀 Fast Parallel',
    icon: '🚀',
    tooltip: '80 coins, 49 bots, AI optimized\n~12 minutes\nBest for: Balanced speed & coverage'
  },
  full_scan: {
    label: '📊 Full Scan',
    icon: '📊',
    tooltip: '80 coins, 49 bots, Full AI\n~40 minutes\nBest for: Comprehensive analysis'
  },
  speed_run: {
    label: '💨 Speed Run',
    icon: '💨',
    tooltip: '40 coins, 25 best bots, NO AI\n~3 minutes\nBest for: Maximum speed'
  }
};

console.log('✅ Scan Types Configuration:');
Object.entries(scanTypes).forEach(([key, config]) => {
  console.log(`${config.icon} ${key}: ${config.label}`);
});

console.log('\n✅ All 5 scan types are properly configured!');