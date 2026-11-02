pub fn run() {
    let h = 1e-6;
    let (x, y, z) = (2.0, 3.0, 1.0);

    let fx = |x: f64, _y: f64, _z: f64| x*x*_y;
    let fy = |_x: f64, y: f64, z: f64| y*z.sin();
    let fz = |_x: f64, _y: f64, z: f64| z*z*z;

    let dfxdx = (fx(x+h,y,z) - fx(x,y,z)) / h;
    let dfydy = (fy(x,y+h,z) - fy(x,y,z)) / h;
    let dfzdz = (fz(x,y,z+h) - fz(x,y,z)) / h;

    let div = dfxdx + dfydy + dfzdz;
    println!("F = (x²y, y·sin z, z³)");
    println!("В точке ({}, {}, {}):", x, y, z);
    println!("  div F = {:.6}", div);
    println!("  Аналитически: 2xy + sin z + 3z² = {:.6}", 2.0*x*y + z.sin() + 3.0*z*z);
}
