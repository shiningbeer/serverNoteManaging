import re
pat_letter = re.compile(r'[^a-z0-9A-Z\\ \- \_ \']')
x=r'''{'TransportProtocol': 'TCP', 'IP': '103.83.145.71', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:00:28', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb8\xf6\xe7'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '111.90.171.204', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:00:51', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb4\x90}'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '113.193.127.110', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:04:47', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xc20J'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '115.248.202.109', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:11:22', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xaa\xff\x17'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '115.96.232.5', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:11:57', 'Data': {'version': '3.8.3.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X5 ', 'MAC_address': '\x00 J\xc6=\xb0'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '116.72.231.67', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:12:02', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xbc\x1f\x99'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '117.205.10.106', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 18:36:23', 'Data': {'version': '3.3.0.1GC', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'YM\xf8', 'MAC_address': '\x00\x80\xa3\x9f\x91j'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '119.82.64.172', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:28:03', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb8\xd4\x02'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '120.63.179.211', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:28:13', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xbc \xc8'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.165.211.60', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:45:17', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xacL\xa2'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.160.153.20', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:45:47', 'Data': {'version': '6.5.0.7', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X5K', 'MAC_address': '\x00 J\xb4\x95q'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.165.164.220', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:45:57', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xbc&\x86'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.175.56.59', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:46:23', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xaa`\x1f'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.180.251.159', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:47:05', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb1a<'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.176.45.64', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:52:32', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xad\xf2^'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.176.55.46', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:52:41', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xc4\xa9\x8c'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '122.176.46.211', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 19:52:47', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xaaB\x83'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.90', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:28:30', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xaa\xff\x1f'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.242.51', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:28:35', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xaa\xd7^'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.4', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:28:56', 'Data': {'version': '0.3.2.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xa8\x13\xae'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.242.55', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:29:27', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xaa\xedX'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.6', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:29:27', 'Data': {'version': '0.3.2.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xa8\x13\xc1'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.3', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:29:32', 'Data': {'version': '0.3.2.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xa8\x07\xc7'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.92', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:29:38', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xac\xed\xa1'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.5', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:30:04', 'Data': {'version': '0.3.2.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xa8\x07\xa1'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.2', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:30:14', 'Data': {'version': '0.3.2.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xa8\x13\xac'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.93', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:30:25', 'Data': {'version': '0.4.0.4', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9c', 'MAC_address': '\x00\x80\xa3\xb6\xfd\xda'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.242.53', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:30:27', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xac\xed!'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.91', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:30:30', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xaa\xe9\x0e'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '14.142.136.94', 'PluginName': 'lantronix-info', 'created_time': '2018-05-18 22:31:17', 'Data': {'version': '0.4.0.0', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X9\x8a', 'MAC_address': '\x00\x80\xa3\xac\xed\x14'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '43.225.165.10', 'PluginName': 'lantronix-info', 'created_time': '2018-05-19 03:59:13', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xba\xaf\xdf'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '43.230.212.59', 'PluginName': 'lantronix-info', 'created_time': '2018-05-19 03:59:27', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xad\xff\xa3'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '59.144.160.68', 'PluginName': 'lantronix-info', 'created_time': '2018-05-19 04:05:42', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb8\xd0\xb9'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '59.90.75.89', 'PluginName': 'lantronix-info', 'created_time': '2018-05-19 04:10:02', 'Data': {'version': '6.8.0.2', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X50', 'MAC_address': '\x00 J\xf5\x19\xff'}, 'Port': 30718}
{'TransportProtocol': 'TCP', 'IP': '59.98.44.224', 'PluginName': 'lantronix-info', 'created_time': '2018-05-19 04:10:07', 'Data': {'version': '6.10.0.1', 'Password': '\x00\x00\x00\x00', 'Device_Type': 'X90', 'MAC_address': '\x00\x80\xa3\xb8\x82\xf0'}, 'Port': 30718}'''
xx= pat_letter.sub(' ',x).strip()
pat2=re.compile(r' +')
xxx=pat2.sub(' ',xx).strip().split(' ')
dd={}
for w in xxx:
    if not dd.has_key(w):
        dd[w]=1
    else:        
        count=dd[w]
        dd[w]=count+1
result=sorted(dd.items(),key = lambda x:x[1],reverse = True)
print result[0:15]



