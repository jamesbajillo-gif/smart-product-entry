import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  databaseApi,
  checkApiConnection,
  REQUIRED_SCHEMA,
  getConfiguredApiUrl,
  setApiUrl,
  TableColumn,
} from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Table,
  Plus,
  Loader2,
  Settings,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TableStatus {
  name: string;
  exists: boolean;
  columns: TableColumn[];
  missingColumns: string[];
  isCreating: boolean;
  createError?: string;
}

export default function DatabaseSetup() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbInfo, setDbInfo] = useState<{ database: string; version: string } | null>(null);
  const [existingTables, setExistingTables] = useState<string[]>([]);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>([]);
  const [manualApiUrl, setManualApiUrl] = useState(() => getConfiguredApiUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const { toast } = useToast();

  const currentApiUrl = getConfiguredApiUrl();

  const checkConnection = async () => {
    setIsLoading(true);
    const connected = await checkApiConnection();
    setIsConnected(connected);

    if (connected) {
      // Get database info
      const infoResult = await databaseApi.getInfo();
      if (infoResult.success && infoResult.data) {
        setDbInfo({
          database: infoResult.data.database,
          version: infoResult.data.version,
        });
      }

      // List existing tables
      const tablesResult = await databaseApi.listTables();
      if (tablesResult.success && tablesResult.data) {
        setExistingTables(tablesResult.data);
      }

      // Check each required table
      await checkRequiredTables(tablesResult.data || []);
    }

    setIsLoading(false);
  };

  const handleSaveApiUrl = () => {
    setApiUrl(manualApiUrl.trim());
    setIsEditingUrl(false);
    toast({
      title: "API URL Updated",
      description: "Click Refresh to test the connection",
    });
  };

  const handleClearApiUrl = () => {
    setApiUrl("");
    setManualApiUrl("");
    setIsEditingUrl(false);
    toast({
      title: "API URL Cleared",
      description: "Using environment variable if available",
    });
  };

  const checkRequiredTables = async (tables: string[]) => {
    const statuses: TableStatus[] = [];

    for (const [key, schema] of Object.entries(REQUIRED_SCHEMA)) {
      const exists = tables.includes(schema.tableName);
      let columns: TableColumn[] = [];
      let missingColumns: string[] = [];

      if (exists) {
        const describeResult = await databaseApi.describeTable(schema.tableName);
        if (describeResult.success && describeResult.data) {
          columns = describeResult.data.columns || [];
          const existingColumnNames = columns.map((c) => c.Field.toLowerCase());

          // Check for missing columns
          missingColumns = schema.columns
            .filter((col) => !existingColumnNames.includes(col.name.toLowerCase()))
            .map((col) => col.name);
        }
      }

      statuses.push({
        name: schema.tableName,
        exists,
        columns,
        missingColumns,
        isCreating: false,
      });
    }

    setTableStatuses(statuses);
  };

  const createTable = async (tableName: string) => {
    const schema = Object.values(REQUIRED_SCHEMA).find((s) => s.tableName === tableName);
    if (!schema) return;

    setTableStatuses((prev) =>
      prev.map((t) => (t.name === tableName ? { ...t, isCreating: true, createError: undefined } : t))
    );

    try {
      const result = await databaseApi.createTable(schema.createSQL);

      if (result.success) {
        toast({
          title: "Success",
          description: `Table "${tableName}" created successfully`,
        });
        // Refresh table status
        await checkConnection();
      } else {
        const errorMsg = result.message || result.error || `Failed to create table "${tableName}"`;
        setTableStatuses((prev) =>
          prev.map((t) => (t.name === tableName ? { ...t, createError: errorMsg } : t))
        );
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = `Failed to create table "${tableName}"`;
      setTableStatuses((prev) =>
        prev.map((t) => (t.name === tableName ? { ...t, createError: errorMsg } : t))
      );
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }

    setTableStatuses((prev) =>
      prev.map((t) => (t.name === tableName ? { ...t, isCreating: false } : t))
    );
  };

  const [showSqlInstructions, setShowSqlInstructions] = useState(false);

  const createAllTables = async () => {
    const tablesToCreate = tableStatuses.filter((t) => !t.exists);
    
    for (const table of tablesToCreate) {
      await createTable(table.name);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const allTablesExist = tableStatuses.length > 0 && tableStatuses.every((t) => t.exists);
  const someTablesMissing = tableStatuses.some((t) => !t.exists);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Database Setup</h1>
                <p className="text-sm text-muted-foreground">
                  Configure and manage MySQL database tables
                </p>
              </div>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={checkConnection}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* API URL Configuration */}
        <div className="glass-panel rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">API Configuration</h2>
            </div>
            {!isEditingUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingUrl(true)}
              >
                Edit
              </Button>
            )}
          </div>

          {isEditingUrl ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  MySQL API URL
                </label>
                <input
                  type="url"
                  value={manualApiUrl}
                  onChange={(e) => setManualApiUrl(e.target.value)}
                  placeholder="https://your-server.com/mysql/api.php"
                  className="w-full px-3 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveApiUrl}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualApiUrl(currentApiUrl);
                    setIsEditingUrl(false);
                  }}
                >
                  Cancel
                </Button>
                {currentApiUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleClearApiUrl}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">API URL:</span>
              {currentApiUrl ? (
                <code className="px-2 py-1 bg-secondary rounded text-foreground break-all">
                  {currentApiUrl}
                </code>
              ) : (
                <span className="text-destructive">Not configured</span>
              )}
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="glass-panel rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Checking connection...</span>
              </>
            ) : isConnected ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <span className="text-foreground font-medium">Connected</span>
                  {dbInfo && (
                    <span className="text-muted-foreground ml-2">
                      to {dbInfo.database} (MySQL {dbInfo.version})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="text-destructive">Connection failed</span>
              </>
            )}
          </div>
        </div>

        {/* Required Tables */}
        {isConnected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Table className="w-5 h-5" />
                Required Tables
              </h2>
              <div className="flex gap-2">
                {someTablesMissing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowSqlInstructions(!showSqlInstructions)}
                    >
                      {showSqlInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Show SQL
                    </Button>
                    <Button size="sm" className="gap-2" onClick={createAllTables}>
                      <Plus className="w-4 h-4" />
                      Create All Missing Tables
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* SQL Instructions Panel */}
            {showSqlInstructions && someTablesMissing && (
              <div className="glass-panel rounded-lg p-4 bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Manual SQL Creation</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const allSql = Object.values(REQUIRED_SCHEMA)
                        .map((s) => s.createSQL)
                        .join(";\n\n");
                      navigator.clipboard.writeText(allSql);
                      toast({ title: "Copied!", description: "All SQL statements copied to clipboard" });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    Copy All SQL
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  The API only allows SELECT queries. Run these statements directly on your MySQL server:
                </p>
                <pre className="text-xs bg-secondary p-3 rounded overflow-x-auto text-foreground whitespace-pre-wrap">
                  {Object.values(REQUIRED_SCHEMA)
                    .map((s) => s.createSQL)
                    .join(";\n\n")}
                </pre>
              </div>
            )}

            {allTablesExist && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span>All required tables exist and are properly configured!</span>
              </div>
            )}

            <div className="space-y-3">
              {tableStatuses.map((table) => (
                <div key={table.name} className="glass-panel rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {table.exists ? (
                        table.missingColumns.length > 0 ? (
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-mono text-foreground font-medium">{table.name}</span>
                      {table.exists ? (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-500 rounded">
                          EXISTS
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-destructive/20 text-destructive rounded">
                          MISSING
                        </span>
                      )}
                    </div>

                    {!table.exists && (
                      <Button
                        size="sm"
                        onClick={() => createTable(table.name)}
                        disabled={table.isCreating}
                        className="gap-2"
                      >
                        {table.isCreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Create Table
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Show required columns */}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Required columns: </span>
                    <span className="text-foreground">
                      {REQUIRED_SCHEMA[table.name as keyof typeof REQUIRED_SCHEMA]?.columns
                        .map((c) => c.name)
                        .join(", ")}
                    </span>
                  </div>

                  {/* Show existing columns if table exists */}
                  {table.exists && table.columns.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-2">Current structure:</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {table.columns.map((col) => (
                          <div
                            key={col.Field}
                            className="text-xs px-2 py-1 bg-secondary/50 rounded font-mono"
                          >
                            <span className="text-foreground">{col.Field}</span>
                            <span className="text-muted-foreground ml-1">({col.Type})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show missing columns warning */}
                  {table.missingColumns.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-500/10 rounded text-yellow-500 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      Missing columns: {table.missingColumns.join(", ")}
                    </div>
                  )}

                  {/* Show create error with SQL instructions */}
                  {table.createError && (
                    <div className="mt-3 p-3 bg-destructive/10 rounded text-sm">
                      <div className="flex items-start gap-2 text-destructive mb-2">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{table.createError}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        The API only allows SELECT queries. Create this table manually using the SQL below.
                      </div>
                      <div className="mt-2 relative">
                        <pre className="text-xs bg-secondary/50 p-2 rounded overflow-x-auto text-foreground">
                          {REQUIRED_SCHEMA[table.name as keyof typeof REQUIRED_SCHEMA]?.createSQL}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              REQUIRED_SCHEMA[table.name as keyof typeof REQUIRED_SCHEMA]?.createSQL || ""
                            );
                            toast({ title: "Copied!", description: "SQL copied to clipboard" });
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Tables in Database */}
        {isConnected && existingTables.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">All Tables in Database</h2>
            <div className="glass-panel rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {existingTables.map((table) => {
                  const isRequired = Object.values(REQUIRED_SCHEMA).some(
                    (s) => s.tableName === table
                  );
                  return (
                    <span
                      key={table}
                      className={`px-3 py-1 rounded font-mono text-sm ${
                        isRequired
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {table}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Not connected message */}
        {!isLoading && !isConnected && (
          <div className="glass-panel rounded-lg p-8 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Cannot Connect to Database</h3>
            <p className="text-muted-foreground mb-4">
              Please ensure the MySQL API is running and the URL is correctly configured.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>1. Set <code className="px-1 bg-secondary rounded">VITE_MYSQL_API_URL</code> environment variable</p>
              <p>2. Ensure the API server is running and accessible</p>
              <p>3. Check CORS settings if accessing from a different domain</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
