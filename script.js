const { jsPDF } = window.jspdf;

let currentEmployee = null;
let employeeData = [];

document.getElementById("fileInput").addEventListener("change", handleFileUpload);
document.getElementById("nameInput").addEventListener("input", searchEmployee);

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const dropZoneText = document.getElementById("dropZoneText");

// Click on drop zone triggers file input
dropZone.addEventListener("click", () => fileInput.click());

// Show file name when selected via click
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    showSelectedFile(fileInput.files[0].name);
    handleFileUpload({ target: { files: [fileInput.files[0]] } });
  }
});

// Handle file drop
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files; // Assign for consistency
    showSelectedFile(file.name);
    handleFileUpload({ target: { files: [file] } });
  }
});

// ✅ Function to display file name with remove button
function showSelectedFile(fileName) {
  dropZoneText.innerHTML = `
  <div class="file-display">
    <i class="fas fa-file-excel" style="color:green;"></i>
    <span>Selected File: <strong>${fileName}</strong></span>
    <button id="removeFileBtn">
      <i class="fas fa-times"></i>
    </button>
  </div>
`;

  // Add event listener for remove button
  document.getElementById("removeFileBtn").addEventListener("click", () => {
    fileInput.value = ""; // Clear input
    dropZoneText.innerHTML = `
      <i class="fas fa-upload"></i> Drag & Drop your Excel file here or click to upload
    `;
    employeeData = []; // Clear data
    document.getElementById("slipContainer").style.display = "none"; // Hide slip
  });
}

  // Add event listener for remove button
  document.getElementById("removeFileBtn").addEventListener("click", () => {
    fileInput.value = ""; // Clear input
    dropZoneText.innerHTML = `
      <i class="fas fa-upload"></i> Drag & Drop your Excel file here or click to upload
    `;
    employeeData = []; // Clear data
    document.getElementById("slipContainer").style.display = "none"; // Hide slip
  });

// Highlight on drag over
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

function handleFileUpload(e) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        let allData = [];

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { range: 0, raw: true });
            jsonData.forEach(row => row.SheetName = sheetName);
            allData = allData.concat(jsonData);
        });

        // ✅ Split main employee data and leave data
        let leaveData = [];
        employeeData = [];

        allData.forEach(row => {
          if (row["Employee Name"] && row["Employee ID"] && row["Gross Earning"]) {
            // Main salary sheet
            employeeData.push(row);
          } else if (
            row["Employee ID"] && 
            (row["Quarterly Opening Balance"] || row["Quarterly Leaves Taken"] || row["Quarterly Closing Balance"] || row["Annual Leave Balance"])
          ) {
            // Likely a leave sheet row
            leaveData.push(row);
          }
        });
        
        // ✅ Create a quick lookup table for leave info by Employee ID
        const leaveLookup = {};
        leaveData.forEach(row => {
          const id = row["Employee ID"]?.toString().trim();
          if (id) {
            leaveLookup[id] = {
              qOpening: row["Quarterly Opening Balance"] || "0",
              qTaken: row["Quarterly Leaves Taken"] || "0",
              qClosing: row["Quarterly Closing Balance"] || "0",
              annual: row["Annual Leave Balance"] || "0"
            };
          }
        });

        // ✅ Merge leave data into employee data
        employeeData = employeeData.map(emp => {
          const id = emp["Employee ID"]?.toString().trim();
          if (leaveLookup[id]) {
            emp["Quarterly Opening Balance"] = leaveLookup[id].qOpening;
            emp["Quarterly Leaves Taken"] = leaveLookup[id].qTaken;
            emp["Quarterly Closing Balance"] = leaveLookup[id].qClosing;
            emp["Annual Leave Balance"] = leaveLookup[id].annual;
          }
          return emp;
        });

        // Format dates + numbers
        employeeData = employeeData.map(emp => {
            if (emp["Date of Joining"]) {
                const doj = emp["Date of Joining"];
                emp["Date of Joining"] = !isNaN(doj) ? formatExcelDate(doj) : formatNormalDate(doj);
            }
            Object.keys(emp).forEach(key => {
              if (typeof emp[key] === "number") {
            
                // ❌ Do NOT round Present Days
                if (key === "Present Days") {
                  emp[key] = Number(emp[key]); // keep as-is (29.5 stays 29.5)
                } else {
                  emp[key] = Math.round(emp[key]); // round salary-related values
                }
            
              }
            });
            return emp;
        });

        // ✅ Fill dropdowns
        populateDropdowns(workbook.SheetNames, employeeData);
    };
    reader.readAsArrayBuffer(e.target.files[0]);
}

// ✅ New helper
function populateDropdowns(sheetNames, data) {
    const sheetDropdown = document.getElementById("sheetDropdown");
    const deptDropdown = document.getElementById("deptDropdown");

    // Clear old options
    sheetDropdown.innerHTML = '<option value="">-- Select Sheet (optional) --</option>';
    deptDropdown.innerHTML = '<option value="">-- Select Department (optional) --</option>';

    // Add sheet names
    sheetNames.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sheetDropdown.appendChild(opt);
    });

    // Add unique departments
    const departments = [...new Set(data.map(emp => emp["Department"]).filter(Boolean))];
    departments.forEach(dep => {
        const opt = document.createElement("option");
        opt.value = dep;
        opt.textContent = dep;
        deptDropdown.appendChild(opt);
    });
}

// Convert Excel serial number to DD-MM-YYYY
function formatExcelDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400; 
    const date_info = new Date(utc_value * 1000);
    const day = String(date_info.getDate()).padStart(2, '0');
    const month = String(date_info.getMonth() + 1).padStart(2, '0');
    const year = date_info.getFullYear();
    return `${day}-${month}-${year}`;
}

// Convert normal date string to DD-MM-YYYY
// Convert normal date string to DD-MM-YYYY
function formatNormalDate(dateStr) {
  if (!dateStr) return "N/A";

  // Case 1: Already in DD-MM-YYYY (e.g. "01-07-2000")
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  }

  // Case 2: Excel/other format (e.g. "2000-07-01", "07/01/2000")
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr; // If invalid, return as is

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function searchEmployee(e) {
  const input = e.target.value.trim().toLowerCase();

  if (!input) {
    document.getElementById("errorMessage").innerText = "";
    document.getElementById("slipContainer").style.display = "none";
    return;
  }

  // Allow multiple names/IDs separated by commas
  const searchTerms = input.split(",").map(term => term.trim()).filter(term => term !== "");

  const employee = employeeData.find(emp => {
    const empName = (emp["Employee Name"] || "").toLowerCase();
    const empId = (emp["Employee ID"] || "").toString().toLowerCase();
    return searchTerms.some(term => empName.includes(term) || empId.includes(term));
  });

  if (!employee) {
    document.getElementById("errorMessage").innerText = "No employee found.";
    document.getElementById("slipContainer").style.display = "none";
    return;
  }

  // Skip if Present Days = 0
  if ((employee["Present Days"] || 0) == 0) {
    document.getElementById("errorMessage").innerText = "Employee has 0 present days. Salary slip will not be generated.";
    document.getElementById("slipContainer").style.display = "none";
    return;
  }

  document.getElementById("errorMessage").innerText = "";
  generateSlip(employee);

}

function generateSlip(emp) {
  currentEmployee = emp; // Store the current employee for filename
  const slipHTML = generateSlipHTML(emp);
  document.getElementById("salarySlip").innerHTML = slipHTML;
  document.getElementById("slipContainer").style.display = "block";
}

function convertNumberToWords(amount) {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
    'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n) {
    if (n < 20) return words[n];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return tens[ten] + (unit ? ' ' + words[unit] : '');
  }

  function getWords(n) {
    if (n === 0) return '';
    let result = '';

    if (Math.floor(n / 10000000) > 0) {
      result += getWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (Math.floor(n / 100000) > 0) {
      result += getWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (Math.floor(n / 1000) > 0) {
      result += getWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (Math.floor(n / 100) > 0) {
      result += getWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (result !== '') result += 'and ';
      result += numToWords(n) + ' ';
    }

    return result.trim();
  }

  const integerPart = Math.floor(amount);
  const paisePart = Math.round((amount - integerPart) * 100);

  let finalWords = 'Rupees ' + getWords(integerPart);
  if (paisePart > 0) {
    finalWords += ' and ' + getWords(paisePart) + ' Paise';
  }
  return finalWords + ' Only';
}

function getPreviousMonthName() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getPreviousMonthName() {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  return prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function generateSlipHTML(emp) {
  const monthName = emp["Month"] || getPreviousMonthName();

  // Parse float utility to avoid NaN and formula issues
function parseAmount(value) {
  return (typeof value === "string" && value.startsWith("=")) ? 0 : parseFloat(value) || 0;
}

// Take Gross Earning from Excel
const grossExcel = parseAmount(emp["Gross Earning"]);

// Split Gross into heads
const basic = Math.round(grossExcel * 0.50);
const da = Math.round(grossExcel * 0.10);
const hra = Math.round(grossExcel * 0.20);
const con = Math.round(grossExcel * 0.20);
const ot = parseAmount(emp["OT Pay"]);
const incentive = parseAmount(emp["Incentives"]);
const special = parseAmount(emp["Special Allowance"]);
const reimburse = parseAmount(emp["Reimbursements"]);

const pf = parseAmount(emp["PF"]);
const esic = parseAmount(emp["ESIC"]);
const pt = parseAmount(emp["PT"]);
const adv = parseAmount(emp["Advances Deduction"]);
const other = parseAmount(emp["Other Deductions"]);

const gross = (basic + da + hra + con + ot + incentive + special + reimburse).toFixed(2);
const deduction = (pf + esic + pt + adv + other).toFixed(2);
const netPayable = (gross - deduction).toFixed(2);

  return `
  <div style="display: flex; justify-content: center; padding: -5px;">
    <div style="width: 210mm; min-height: 148.5mm; max-height: 148.5mm; border: 1px solid black; padding: 10px; font-family: Arial, sans-serif; font-size: 12px; box-sizing: border-box; position: relative;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black;" cellspacing="0" cellpadding="6">
        <tr>
          <td style="width: 20%; vertical-align: middle;">
            <img src="logo.png" style="height: 50px;">
          </td>
          <td style="width: 80%; text-align: left; vertical-align: middle;">
            <div style="text-align: center; line-height: 1.4;">
              <strong>Pioneer Enterprises (India) Pvt. Ltd.</strong><br>
              Gat No. 943, Hissa No. 2/1/B/2/2, Sanaswadi, Shirur, Pune, Maharashtra 412 208<br>
              <strong>Phone:</strong> 95033 80001 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Email:</strong> team@pioneerentp.in
            </div>
          </td>
        </tr>
      </table>

      <h3 style="text-align: center; margin: 5px 0;">Payslip For The Month Of - <strong>${monthName}</strong></h3>

      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid black;" cellspacing="0" cellpadding="6">
        <colgroup>
          <col style="width: 33.33%;">
          <col style="width: 33.33%;">
          <col style="width: 33.33%;">
          <col style="width: 33.33%;">
        </colgroup>
        <tr>
          <td style="border: 1px solid black;"><strong>Emp. No:</strong> ${emp["Employee ID"] || "N/A"}</td>
          <td style="border: 1px solid black;"><strong>Name:</strong> ${emp["Employee Name"]}</td>
          <td style="border: 1px solid black;"><strong>Gender:</strong> ${emp["Gender"] || "N/A"}</td>
          <td style="border: 1px solid black;"><strong>PAN Card No.:</strong> ${emp["PAN No."] || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;"><strong>Date of Joining:</strong> ${formatNormalDate(emp["Date of Joining"]) || "N/A"}</td>
          <td style="border: 1px solid black;"><strong>Department:</strong> ${emp["Department"] || "N/A"}</td>
          <td style="border: 1px solid black;"><strong>Designation:</strong> ${emp["Designation"] || "N/A"}</td>
          <td style="border: 1px solid black;"><strong>UAN No.:</strong> ${emp["UAN No."] || "N/A"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;"><strong>Quarterly Opening Balance:</strong> ${emp["Quarterly Opening Balance"] || "0"}</td>
          <td style="border: 1px solid black;"><strong>Quarterly Leaves Taken:</strong> ${emp["Quarterly Leaves Taken"] || "0"}</td>
          <td style="border: 1px solid black;"><strong>Quarterly Closing Balance:</strong> ${emp["Quarterly Closing Balance"] || "0"}</td>
          <td style="border: 1px solid black;"><strong>ESIC No.:</strong> ${emp["ESIC No."] || "N/A"}</td>
        </tr>
        <tr>
          <td colspan="3" style="border: 1px solid black;"><strong>Annual Leave Balance:</strong> ${emp["Annual Leave Balance"] || "0"}</td>
          <td style="border: 1px solid black;"><strong>Present Days:</strong> ${emp["Present Days"]}</td>
        </tr>
      </table>
      <br>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid black;" cellspacing="0" cellpadding="6">
        <tr>
          <th colspan="2" style="border: 1px solid black; width: 50%;">Earnings</th>
          <th colspan="2" style="border: 1px solid black; width: 50%;">Deductions</th>
        </tr>
        <tr>
          <td style="border: 1px solid black;">Basic</td><td style="border: 1px solid black; width: 25%;">₹${basic}</td>
          <td style="border: 1px solid black;">Employee PF</td><td style="border: 1px solid black; width: 25%;">₹${emp["PF"] || 0}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;">DA</td><td style="border: 1px solid black;">₹${da}</td>
          <td style="border: 1px solid black;">Employee ESIC</td><td style="border: 1px solid black;">₹${emp["ESIC"] || 0}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;">HRA</td><td style="border: 1px solid black;">₹${hra}</td>
          <td style="border: 1px solid black;">PT</td><td style="border: 1px solid black;">₹${emp["PT"] || 0}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;">Conveyance Allowance</td><td style="border: 1px solid black;">₹${con}</td>
          <td style="border: 1px solid black;">TDS</td><td style="border: 1px solid black;">₹${emp[""] || 0}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;">OT (If Applicable)</td><td style="border: 1px solid black;">₹${emp["OT Pay"] || 0}</td>
          <td style="border: 1px solid black;">Advances (If any)</td><td style="border: 1px solid black;">₹${emp["Advances Deduction"] || 0}</td>
        </tr>
        <tr>
          <td style="border: 1px solid black;">Incentives</td><td style="border: 1px solid black;">₹${emp["Incentives"] || 0}</td>
          <td style="border: 1px solid black;">Other Deductions (If any)</td><td style="border: 1px solid black;">₹${emp["Other Deductions"] || 0}</td>
        </tr>
        <tr>
        <td style="border: 1px solid black;">Special Allowance</td><td style="border: 1px solid black;">₹${emp["Special Allowance"] || 0}</td>
        <td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td>
          </tr>
          <tr>
          <td style="border: 1px solid black;">Reimbursements</td><td style="border: 1px solid black;">₹${emp["Reimbursements"] || 0}</td>
          <td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td>
        </tr>
        <tr>
          <td colspan="2" style="border: 1px solid black;"><strong>Gross Earnings: ₹${gross}</strong></td>
          <td colspan="2" style="border: 1px solid black;"><strong>Total Deductions: ₹${deduction}</strong></td>
        </tr>
        <tr>
          <td colspan="4" style="border: 1px solid black;">
            <strong>Net Payable: ₹${netPayable}</strong>&nbsp;&nbsp;(${convertNumberToWords(netPayable)})
          </td>
        </tr>
      </table>
      <div style="position: absolute; bottom: 5px; left: 0; width: 100%; text-align: center; font-weight: bold;">
        This is computer generated payslip. It does not require a signature.
      </div>
    </div>
  </div>
  `;
}

async function downloadSelectedPDFs() {
  const input = document.getElementById("nameInput").value.trim();
  const selectedSheet = document.getElementById("sheetDropdown").value.trim().toLowerCase();
  const selectedDept = document.getElementById("deptDropdown").value.trim().toLowerCase();

  if (!input && !selectedSheet && !selectedDept) {
    alert("Enter Name/ID or select Sheet/Department.");
    return;
  }

  if (employeeData.length === 0) {
    alert("Upload Excel first.");
    return;
  }

  const searchTerms = input ? input.split(",").map(term => term.trim().toLowerCase()) : [];

  const selectedEmployees = employeeData.filter(emp => {
    const empName = (emp["Employee Name"] || "").toLowerCase();
    const empId = (emp["Employee ID"] || "").toString().toLowerCase();
    const sheetName = (emp["SheetName"] || "").toLowerCase();
    const department = (emp["Department"] || "").toLowerCase();
    const presentDays = parseInt(emp["Present Days"]) || 0;

    // Skip employees with 0 days
    if (presentDays === 0) return false;

    // ✅ Match Name/ID search
    const matchesText = searchTerms.length === 0 ? true :
      searchTerms.some(term => empName.includes(term) || empId.includes(term) || sheetName.includes(term) || department.includes(term));

    // ✅ Match dropdown selections
    const matchesSheet = selectedSheet ? sheetName === selectedSheet : true;
    const matchesDept = selectedDept ? department === selectedDept : true;

    return matchesText && matchesSheet && matchesDept;
  });

  if (selectedEmployees.length === 0) {
    alert("No matching employees found.");
    return;
  }

  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const halfPageHeight = pageHeight / 2;

  for (let i = 0; i < selectedEmployees.length; i++) {
    const emp = selectedEmployees[i];
    const slipHTML = generateSlipHTML(emp);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = slipHTML;
    tempDiv.style.width = "210mm"; // match A4 width
    tempDiv.style.minHeight = "148mm"; // half of 297mm
    tempDiv.style.padding = "20px";
    tempDiv.style.boxSizing = "border-box";
    document.body.appendChild(tempDiv);

    const canvas = await html2canvas(tempDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/jpeg", 1.0);

    const positionY = i % 2 === 0 ? 0 : halfPageHeight;

    if (i % 2 === 1) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.3);
      pdf.line(10, halfPageHeight, pageWidth - 10, halfPageHeight);
    }

    pdf.addImage(imgData, 'JPEG', 0, positionY, pageWidth, halfPageHeight);

    document.body.removeChild(tempDiv);

    if (i % 2 === 1 && i !== selectedEmployees.length - 1) {
      pdf.addPage();
    }
  }

  pdf.save("Selected_Salary_Slips.pdf");

  if (loader) loader.style.display = "none";
}

function downloadPDF() {
  const slip = document.getElementById("salarySlip");
  if (!slip || slip.innerHTML.trim() === "") {
    alert("No salary slip to download. Please search for an employee.");
    return;
  }

  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";

  html2canvas(slip, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight() / 2;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    // ✅ Use Employee Name correctly
    const name = (currentEmployee?.["Employee Name"] || currentEmployee?.["Employee ID"])
    .replace(/\s+/g, "_"); // replace spaces with underscores
    const month = currentEmployee?.Month || getPreviousMonthName();

    pdf.save(`${name}_Salary_Slip_${month}.pdf`);

    if (loader) loader.style.display = "none";
  });
}

async function downloadAllPDFs() {
  if (employeeData.length === 0) {
    alert("Upload Excel first.");
    return;
  }

  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const halfPageHeight = pageHeight / 2;

  for (let i = 0; i < employeeData.length; i++) {
    const emp = employeeData[i];
     
    // 🚨 Skip employees with 0 days
    const presentDays = parseInt(emp["Present Days"]) || 0;
    if (presentDays === 0) continue;

    const slipHTML = generateSlipHTML(emp);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = slipHTML;
    tempDiv.style.width = "210mm"; // match A4 width
    tempDiv.style.minHeight = "148mm"; // half of 297mm
    tempDiv.style.padding = "20px";
    tempDiv.style.boxSizing = "border-box";
    document.body.appendChild(tempDiv);

    const canvas = await html2canvas(tempDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/jpeg", 1.0);

    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    const positionY = i % 2 === 0 ? 0 : halfPageHeight;

    // Draw a horizontal line divider after the first slip (on top)
    if (i % 2 === 1) {
      pdf.setDrawColor(0); // gray
      pdf.setLineWidth(0.3);
      pdf.line(10, halfPageHeight, pageWidth - 10, halfPageHeight); // from (x1, y1) to (x2, y2)
    }

    pdf.addImage(imgData, 'JPEG', 0, positionY, pageWidth, halfPageHeight);

    document.body.removeChild(tempDiv);

    // Add new page after every 2 slips
    if (i % 2 === 1 && i !== employeeData.length - 1) {
      pdf.addPage();
    }
  }

  pdf.save("All_Salary_Slips.pdf");

  if (loader) loader.style.display = "none";
}

