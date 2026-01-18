#!/bin/bash

# Document Count Monitor Management Script

SCRIPT_DIR="/home/kashish-webcue/Programming/WebCue/WebCue Ads Library/opensearch-diff-sync"
SERVICE_NAME="document-count-monitor"
SERVICE_FILE="$SCRIPT_DIR/document-count-monitor.service"

case "$1" in
    start)
        echo "🚀 Starting Document Count Monitor..."
        
        # Start as background process
        cd "$SCRIPT_DIR"
        nohup node start-count-monitor.js > logs/count-monitor.log 2>&1 &
        echo $! > logs/count-monitor.pid
        
        echo "✅ Document Count Monitor started (PID: $(cat logs/count-monitor.pid))"
        echo "📝 Logs: logs/count-monitor.log"
        echo "📊 Monitor will check document counts every 5 hours"
        ;;
        
    stop)
        echo "🛑 Stopping Document Count Monitor..."
        
        if [ -f logs/count-monitor.pid ]; then
            PID=$(cat logs/count-monitor.pid)
            if kill -0 $PID 2>/dev/null; then
                kill $PID
                rm logs/count-monitor.pid
                echo "✅ Document Count Monitor stopped"
            else
                echo "⚠️ Process not running"
                rm logs/count-monitor.pid
            fi
        else
            echo "⚠️ No PID file found"
        fi
        ;;
        
    restart)
        echo "🔄 Restarting Document Count Monitor..."
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        echo "📊 Document Count Monitor Status:"
        
        if [ -f logs/count-monitor.pid ]; then
            PID=$(cat logs/count-monitor.pid)
            if kill -0 $PID 2>/dev/null; then
                echo "✅ Running (PID: $PID)"
                echo "📝 Log file: logs/count-monitor.log"
                echo "📈 Recent activity:"
                tail -5 logs/count-monitor.log 2>/dev/null || echo "No recent logs"
            else
                echo "❌ Not running (stale PID file)"
                rm logs/count-monitor.pid
            fi
        else
            echo "❌ Not running"
        fi
        ;;
        
    logs)
        echo "📝 Document Count Monitor Logs:"
        if [ -f logs/count-monitor.log ]; then
            tail -20 logs/count-monitor.log
        else
            echo "No log file found"
        fi
        ;;
        
    test)
        echo "🧪 Running manual document count check..."
        cd "$SCRIPT_DIR"
        node -e "
        const monitor = require('./src/services/documentCountMonitor');
        monitor.triggerManualCheck()
          .then(result => {
            console.log('📊 Manual Check Result:', result);
            process.exit(0);
          })
          .catch(error => {
            console.error('❌ Manual check failed:', error);
            process.exit(1);
          });
        "
        ;;
        
    auto-sync-config)
        echo "⚙️ Auto-sync Configuration:"
        echo ""
        echo "Current settings:"
        curl -s http://localhost:3000/api/count-monitor/auto-sync/config 2>/dev/null | jq . || echo "Service not running or jq not installed"
        echo ""
        echo "Usage:"
        echo "  Enable auto-sync:"
        echo "    curl -X POST http://localhost:3000/api/count-monitor/auto-sync/enable -H 'Content-Type: application/json' -d '{\"enabled\": true}'"
        echo ""
        echo "  Disable auto-sync:"
        echo "    curl -X POST http://localhost:3000/api/count-monitor/auto-sync/enable -H 'Content-Type: application/json' -d '{\"enabled\": false}'"
        echo ""
        echo "  Set threshold (e.g., 1000 documents):"
        echo "    curl -X POST http://localhost:3000/api/count-monitor/auto-sync/threshold -H 'Content-Type: application/json' -d '{\"threshold\": 1000}'"
        ;;
        
    enable-auto-sync)
        echo "🔄 Enabling auto-sync..."
        curl -X POST http://localhost:3000/api/count-monitor/auto-sync/enable \
          -H "Content-Type: application/json" \
          -d '{"enabled": true}' 2>/dev/null | jq . || echo "Auto-sync enabled"
        ;;
        
    disable-auto-sync)
        echo "🛑 Disabling auto-sync..."
        curl -X POST http://localhost:3000/api/count-monitor/auto-sync/enable \
          -H "Content-Type: application/json" \
          -d '{"enabled": false}' 2>/dev/null | jq . || echo "Auto-sync disabled"
        ;;
        
    set-threshold)
        THRESHOLD=\${2:-1000}
        echo "📊 Setting auto-sync threshold to $THRESHOLD documents..."
        curl -X POST http://localhost:3000/api/count-monitor/auto-sync/threshold \
          -H "Content-Type: application/json" \
          -d "{\"threshold\": $THRESHOLD}" 2>/dev/null | jq . || echo "Threshold set to $THRESHOLD"
        ;;
        
    install-systemd)
        echo "🔧 Installing systemd service..."
        
        # Copy service file
        sudo cp "$SERVICE_FILE" /etc/systemd/system/
        
        # Reload systemd
        sudo systemctl daemon-reload
        
        # Enable service
        sudo systemctl enable "$SERVICE_NAME"
        
        echo "✅ Systemd service installed and enabled"
        echo "📝 Use 'sudo systemctl start $SERVICE_NAME' to start"
        echo "📝 Use 'sudo systemctl status $SERVICE_NAME' to check status"
        ;;
        
    uninstall-systemd)
        echo "🗑️ Uninstalling systemd service..."
        
        # Stop and disable service
        sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
        sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
        
        # Remove service file
        sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"
        
        # Reload systemd
        sudo systemctl daemon-reload
        
        echo "✅ Systemd service uninstalled"
        ;;
        
    *)
        echo "📋 Document Count Monitor Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|test|auto-sync-config|enable-auto-sync|disable-auto-sync|set-threshold|install-systemd|uninstall-systemd}"
        echo ""
        echo "Commands:"
        echo "  start           - Start the monitor as background process"
        echo "  stop            - Stop the monitor"
        echo "  restart         - Restart the monitor"
        echo "  status          - Show monitor status"
        echo "  logs            - Show recent logs"
        echo "  test            - Run manual count check"
        echo ""
        echo "Auto-sync Commands:"
        echo "  auto-sync-config    - Show auto-sync configuration"
        echo "  enable-auto-sync    - Enable automatic sync on mismatches"
        echo "  disable-auto-sync   - Disable automatic sync"
        echo "  set-threshold [N]   - Set auto-sync threshold (default: 1000)"
        echo ""
        echo "Service Commands:"
        echo "  install-systemd    - Install as systemd service"
        echo "  uninstall-systemd  - Remove systemd service"
        echo ""
        echo "📊 The monitor checks MongoDB vs OpenSearch document counts every 5 hours"
        echo "🔄 Auto-sync: Automatically triggers full sync when difference > threshold"
        echo "📝 Logs are written to: logs/count-monitor.log"
        ;;
esac
