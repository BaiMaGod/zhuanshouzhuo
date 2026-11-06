/** Keep long sandbox paths out of the small game modal, but available to copy. */
export function cloudRestoreMessage(notice:string):{lines:string[];backupPath:string}{
 const marker='备份文件：';
 const at=notice.lastIndexOf(marker);
 const backupPath=at<0?'':notice.slice(at+marker.length).trim();
 const match=/发现\s+(\d+)\s+局旧版未完成盘面与当前关卡不兼容（([^）]+)）/.exec(notice);
 const affected=match?`检测到 ${match[1]} 局旧版未完成盘面与当前关卡不兼容（${match[2]}）。`:'检测到旧版未完成盘面与当前关卡不兼容。';
 return {
  lines:[
   affected,
   '原始云档已备份，不兼容的未完成盘面已隔离。',
   '已通关成绩、星星、道具和其他有效盘面均已保留。',
   ...(backupPath?['如需留存或排查，可点击下方按钮复制备份路径。']:[])
  ],
  backupPath
 };
}
