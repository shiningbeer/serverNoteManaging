import os
p=os.popen('python print.py 192.1.1.1')
s= p.read()
s=s.strip()
dd=s.split('\n')
print dd