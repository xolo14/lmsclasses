"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateHeaders: string[];
  templateSampleRows: string[][];
  headerMapping: Record<string, string>; // Maps DB field name to Excel header string
  onImport: (data: any[]) => Promise<{ successCount: number; error?: string }>;
  onSuccess?: () => void;
}

export function BulkImportModal({
  open,
  onOpenChange,
  title,
  description,
  templateHeaders,
  templateSampleRows,
  headerMapping,
  onImport,
  onSuccess,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template dynamically using SheetJS
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateSampleRows]);
      
      // Auto-fit column widths
      const maxColWidths = templateHeaders.map((header, colIndex) => {
        let maxLen = header.length;
        templateSampleRows.forEach((row) => {
          const cellVal = String(row[colIndex] ?? "");
          if (cellVal.length > maxLen) maxLen = cellVal.length;
        });
        return { wch: maxLen + 4 };
      });
      ws["!cols"] = maxColWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      
      const fileName = `${title.toLowerCase().replace(/\s+/g, "_")}_template.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Failed to generate template:", err);
      setError("Failed to download template. Try again.");
    }
  };

  // Helper function to map case-insensitively and ignore whitespaces
  const mapRowData = (row: any) => {
    const mapped: Record<string, any> = {};
    const rowKeys = Object.keys(row);
    
    for (const [dbField, excelHeader] of Object.entries(headerMapping)) {
      const targetClean = excelHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // Search matching key in parsed row
      const matchedKey = rowKeys.find((k) => {
        return k.toLowerCase().replace(/[^a-z0-9]/g, "") === targetClean;
      });
      
      if (matchedKey !== undefined) {
        mapped[dbField] = row[matchedKey];
      } else {
        mapped[dbField] = ""; // default empty
      }
    }
    return mapped;
  };

  // Handle file upload and parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setPreviewData([]);
    setParsing(true);

    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          if (workbook.SheetNames.length === 0) {
            throw new Error("No worksheets found in this Excel file.");
          }
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json<any>(worksheet);

          if (rawJson.length === 0) {
            throw new Error("Excel sheet contains no data rows.");
          }

          // Map the raw columns to DB expected fields
          const mappedRows = rawJson.map((row) => mapRowData(row));
          setPreviewData(mappedRows);
        } catch (parseErr: any) {
          setError(parseErr?.message || "Failed to parse file. Ensure it is a valid Excel or CSV sheet.");
          setFile(null);
        } finally {
          setParsing(false);
        }
      };

      reader.onerror = () => {
        setError("Error reading the file.");
        setFile(null);
        setParsing(false);
      };

      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      console.error(err);
      setError("Failed to load Excel parsing engine.");
      setFile(null);
      setParsing(false);
    }
  };

  const handleImportSubmit = async () => {
    if (previewData.length === 0) {
      setError("No valid data available to import.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await onImport(previewData);
      if (response.error) {
        setError(response.error);
      } else {
        setSuccess(`Successfully imported ${response.successCount} record(s).`);
        setFile(null);
        setPreviewData([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err?.message || "Server error during bulk import.");
    } finally {
      setLoading(false);
    }
  };

  const resetModalState = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    setSuccess(null);
    setLoading(false);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetModalState();
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-5">
          {/* Step 1: Download Template */}
          <div className="rounded-lg border border-border bg-card/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-sm">Step 1: Download Template</h4>
              <p className="text-xs text-muted-foreground">Download the structured Excel template with correct headers.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 shrink-0">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* Step 2: Upload File */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Step 2: Upload File</h4>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/10 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
              {file ? (
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Click to upload file</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Supports .xlsx, .xls, and .csv</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Parsing file contents...
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <span className="font-semibold">Import Failed</span>
                <p className="mt-1 text-xs leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line font-mono bg-destructive/5 p-2 rounded-md">
                  {error}
                </p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-3 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Success</span>
                <p className="mt-0.5 text-xs">{success}</p>
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Preview Records ({previewData.length})</h4>
                <span className="text-xs text-muted-foreground">Showing first 10 rows</span>
              </div>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground uppercase font-medium border-b border-border">
                    <tr>
                      {Object.values(headerMapping).map((h, idx) => (
                        <th key={idx} className="px-3 py-2 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {previewData.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/30">
                        {Object.keys(headerMapping).map((colKey, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 truncate max-w-[150px]" title={String(row[colKey] ?? "")}>
                            {String(row[colKey] ?? "") || <em className="text-muted-foreground/60">empty</em>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleImportSubmit} 
            disabled={loading || previewData.length === 0}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Import {previewData.length > 0 ? `(${previewData.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
