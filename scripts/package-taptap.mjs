import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyTapPackage} from './verify-taptap.mjs';

// The only TapTap ZIP entry point: validate the actual compiled directory first.
export function packageTapBuild(root='dist',output){
 const manifest=verifyTapPackage(root);
 if(!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version??''))throw Error('Invalid TapTap package version');
 const target=resolve(output??`.release-out/zhuanshouzhuo-${manifest.version}-taptap.zip`);
 if(target===resolve(root)||target.startsWith(resolve(root)+'/'))throw Error('ZIP output must be outside the H5 directory');
 mkdirSync(dirname(target),{recursive:true});
 const temporary=target+'.tmp';
 try{
  const result=spawnSync('python3',['-c',`
import hashlib, pathlib, sys, zipfile
root, output = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
files = sorted(root.rglob('*'))
if any(p.is_symlink() for p in files):
    raise RuntimeError('H5 package must not contain symbolic links')
expected = {}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        if path.is_file():
            name = 'zhuanshouzhuo/' + path.relative_to(root).as_posix()
            data = path.read_bytes()
            archive.writestr(name, data)
            expected[name] = hashlib.sha256(data).digest()
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None or set(archive.namelist()) != set(expected):
        raise RuntimeError('H5 ZIP integrity check failed')
    for name, digest in expected.items():
        if hashlib.sha256(archive.read(name)).digest() != digest:
            raise RuntimeError('H5 ZIP content mismatch: ' + name)
    if 'zhuanshouzhuo/index.html' not in expected:
        raise RuntimeError('H5 ZIP entry point missing')
`,resolve(root),temporary],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.error?.message||result.stderr||'H5 ZIP creation failed');
  renameSync(temporary,target);
 }finally{rmSync(temporary,{force:true})}
 return {path:target,version:manifest.version,appId:manifest.appId,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // Always rebuild through the strict release path. Never fall back to a Web build.
 const build=spawnSync(process.execPath,['scripts/build-taptap.mjs'],{stdio:'inherit'});
 if(build.status!==0)process.exit(build.status??1);
 console.log(JSON.stringify(packageTapBuild(),null,2));
}
