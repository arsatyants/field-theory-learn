pub fn run() {
    let h = 1e-6;
    let (x, y, z) = (2.0, 3.0, 1.0);

    let f = |x: f64, y: f64, z: f64| x*x*y + z*z*z;

    let dfdx = (f(x+h,y,z) - f(x,y,z)) / h;
    let dfdy = (f(x,y+h,z) - f(x,y,z)) / h;
    let dfdz = (f(x,y,z+h) - f(x,y,z)) / h;

    println!("f({}, {}, {}) = {}", x, y, z, f(x,y,z));
    println!("∇f = ({:.6}, {:.6}, {:.6})", dfdx, dfdy, dfdz);
    println!("Аналитически: (2xy, x², 3z²) = ({:.6}, {:.6}, {:.6})", 2.0*x*y, x*x, 3.0*z*z);
}
