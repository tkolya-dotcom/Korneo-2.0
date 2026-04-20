import os
import re

base_dir = r"C:\Users\Tkolya\.minimax-agent\projects\korneo2-fix\apps\mobile\app\(app)"
files = [
    "tasks.tsx",
    "projects.tsx",
    "installations.tsx",
    "purchase-requests.tsx",
    "archive.tsx",
    "index.tsx",
    "avr/index.tsx",
    "chat/index.tsx",
    "chat/[id]/index.tsx",
    "installation/[id].tsx",
    "installation/create/index.tsx",
    "installation/[id]/comments/index.tsx",
    "task/[id].tsx",
    "task/create/index.tsx",
    "task/[id]/comments/index.tsx",
    "project/[id].tsx",
    "sites/index.tsx",
    "users/index.tsx",
    "warehouse/index.tsx"
]

modified_files = []

def add_import(content):
    if 'import { COLORS } from' in content or 'import {COLORS} from' in content:
        return content
    lines = content.split('\n')
    last_import_line = -1
    for i, line in enumerate(lines):
        s_line = line.strip()
        # Find lines that look like the end of an import statement
        if (s_line.startswith('import ') or s_line.startswith('} from ')) and ('"' in s_line or "'" in s_line):
            last_import_line = i
        elif 'from "' in s_line or "from '" in s_line:
            last_import_line = i
            
    insert_idx = max(0, last_import_line + 1)
    lines.insert(insert_idx, "import { COLORS } from '@/src/theme/colors';")
    return '\n'.join(lines)

for file_subpath in files:
    filepath = os.path.join(base_dir, file_subpath)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find whole word 'C.'
    # Note: re.sub will correctly replace `C.` with `COLORS.`
    if re.search(r'\bC\.', content):
        new_content = re.sub(r'\bC\.', 'COLORS.', content)
        new_content = add_import(new_content)
                
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(new_content)
            
        modified_files.append(file_subpath)

print("---MODIFIED_FILES_START---")
for m in modified_files:
    print(m)
print("---MODIFIED_FILES_END---")